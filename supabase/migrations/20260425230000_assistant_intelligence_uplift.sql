-- Assistant intelligence uplift.
--
-- Six pieces, one migration so they ship together:
--   1. pgvector extension + dori_semantic_memories — RAG over notes,
--      episodic memories, completed tasks, and chat turns. The chat
--      function retrieves top-k by cosine similarity per turn instead
--      of dumping a fixed snapshot.
--   2. dori_conversation_state — short-term cross-turn state (open
--      intent, pending confirmations, last referenced entity ids) so
--      multi-turn flows like "reschedule that" survive context refetches.
--   3. dori_task_stats — rolling per-user completion stats (median
--      lead time, slip rate, preferred hour-of-day per category) used
--      by both the learned-preferences rollup and the predictive
--      proactive scorer.
--   4. dori_intent_routing — log of specialist routing decisions
--      (general/health/family/meeting/finance) for debugging and
--      offline evaluation.
--   5. match_semantic_memories() — cosine-similarity RPC used by the
--      chat function. Wraps the IVFFlat lookup with the user_id filter
--      and an optional workspace scope.
--   6. dori_slip_risk view — joins open tasks with task_stats to expose
--      a 0-1 risk score the proactive-assistant can prioritise on.
--
-- All tables are user-scoped with RLS. Service role bypasses for the
-- background rollup + embedding workers.

-- ============================================================
-- 1. pgvector
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.dori_semantic_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN (
    'note', 'episodic', 'task_completed', 'event_past',
    'chat_turn', 'memory', 'contact', 'manual'
  )),
  source_ref TEXT,
  content TEXT NOT NULL,
  -- 768-dim covers both Gemini text-embedding-004 and a downscaled
  -- OpenAI text-embedding-3-small (1536 → 768 via Matryoshka). Pick
  -- one dimension and stick to it; mixing dims would corrupt search.
  embedding vector(768),
  metadata JSONB DEFAULT '{}'::jsonb,
  importance NUMERIC DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, source_ref)
);

-- HNSW (not IVFFlat) because:
--   1. RAG datasets are *dynamic* — new chat turns and notes land
--      every minute. IVFFlat needs the index trained on a
--      representative sample, then degrades as the data drifts and
--      requires periodic REINDEX. HNSW supports incremental writes
--      with no maintenance.
--   2. Recall vs. speed: HNSW has better recall at the same query
--      latency for our size class (~10k–1M rows/user).
--   3. Cosine because embeddings are L2-normalised by the embedding
--      provider, so cosine ≈ dot product ranks identically but is
--      invariant to scale drift between embedder versions.
-- m=16 / ef_construction=64 are the pgvector defaults — fine for our
-- workload. Raise ef_construction (build cost) for higher recall.
CREATE INDEX IF NOT EXISTS dori_semantic_memories_embedding_idx
  ON public.dori_semantic_memories USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS dori_semantic_memories_user_recent_idx
  ON public.dori_semantic_memories (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dori_semantic_memories_workspace_idx
  ON public.dori_semantic_memories (user_id, workspace_id, created_at DESC);

ALTER TABLE public.dori_semantic_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own semantic memories"
  ON public.dori_semantic_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own semantic memories"
  ON public.dori_semantic_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own semantic memories"
  ON public.dori_semantic_memories FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_dori_semantic_memories_updated_at
  BEFORE UPDATE ON public.dori_semantic_memories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cosine-similarity search RPC. Service-role calls bypass RLS but we
-- always pass p_user_id so the WHERE clause locks results to the
-- caller; never expose this RPC to the anon key.
CREATE OR REPLACE FUNCTION public.match_semantic_memories(
  p_user_id UUID,
  p_query_embedding vector(768),
  p_workspace_id UUID DEFAULT NULL,
  p_match_count INT DEFAULT 8,
  p_min_similarity NUMERIC DEFAULT 0.65
)
RETURNS TABLE (
  id UUID,
  source TEXT,
  source_ref TEXT,
  content TEXT,
  metadata JSONB,
  importance NUMERIC,
  created_at TIMESTAMPTZ,
  similarity NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    m.id,
    m.source,
    m.source_ref,
    m.content,
    m.metadata,
    m.importance,
    m.created_at,
    1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM public.dori_semantic_memories m
  WHERE m.user_id = p_user_id
    AND m.embedding IS NOT NULL
    AND (
      p_workspace_id IS NULL
        AND m.workspace_id IS NULL
      OR p_workspace_id IS NOT NULL
        AND (m.workspace_id = p_workspace_id OR m.workspace_id IS NULL)
    )
    AND 1 - (m.embedding <=> p_query_embedding) >= p_min_similarity
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_semantic_memories(UUID, vector, UUID, INT, NUMERIC) TO authenticated, service_role;

-- ============================================================
-- 2. Cross-turn conversation state
-- ============================================================
-- One active state row per (user, channel). Multi-turn flows write
-- their open intent + pending entity references here so the next turn
-- can resolve "do it" / "the meeting" / "him" without re-asking.
CREATE TABLE IF NOT EXISTS public.dori_conversation_state (
  user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'tg_private', 'tg_family', 'voice')),
  -- Open intent (e.g. 'awaiting_plan_approval', 'choose_among_candidates',
  -- 'confirm_email_send'). NULL = no pending state.
  open_intent TEXT,
  -- The proposed plan / candidates / draft, kept verbatim so the next
  -- turn can re-emit it on confirmation.
  pending_payload JSONB DEFAULT '{}'::jsonb,
  -- Most recently referenced concrete entities (task_id, event_id,
  -- contact_id, …). The chat function uses this to resolve pronouns.
  recent_entities JSONB DEFAULT '[]'::jsonb,
  -- Specialist the router last selected — used to keep follow-up
  -- turns inside the same specialist mindset unless the topic shifts.
  active_specialist TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel)
);

CREATE INDEX IF NOT EXISTS dori_conversation_state_expiry_idx
  ON public.dori_conversation_state (expires_at)
  WHERE open_intent IS NOT NULL;

ALTER TABLE public.dori_conversation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conv state"
  ON public.dori_conversation_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users upsert own conv state"
  ON public.dori_conversation_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conv state"
  ON public.dori_conversation_state FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own conv state"
  ON public.dori_conversation_state FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. Per-user completion stats (rolled up nightly)
-- ============================================================
-- Aggregated from `tasks`. The rollup job rewrites the row, so we
-- keep a single row per (user_id, category, hour_bucket).
CREATE TABLE IF NOT EXISTS public.dori_task_stats (
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  -- Bucketed hour-of-day (0-23) for slot-preference learning. -1 is
  -- the sentinel for "all hours" (category-level aggregate). NOT NULL
  -- so the PRIMARY KEY collapses correctly — Postgres treats NULL as
  -- distinct in unique constraints, which would let dupes through.
  hour_bucket SMALLINT NOT NULL CHECK (hour_bucket BETWEEN -1 AND 23),
  -- Sample size for confidence weighting.
  sample_size INTEGER NOT NULL DEFAULT 0,
  -- Median lead time in hours (created_at → completed_at). Used for
  -- realistic due-date suggestions.
  median_lead_hours NUMERIC,
  -- Fraction of tasks completed by their due_date. 1.0 = always on
  -- time, 0.0 = always slips.
  on_time_rate NUMERIC,
  -- Median delay in hours past due_date (only counts tasks that
  -- actually slipped, so this is unbiased by sometimes-on-time tasks).
  median_slip_hours NUMERIC,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category, hour_bucket)
);

CREATE INDEX IF NOT EXISTS dori_task_stats_user_idx
  ON public.dori_task_stats (user_id, computed_at DESC);

ALTER TABLE public.dori_task_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own task stats"
  ON public.dori_task_stats FOR SELECT
  USING (auth.uid() = user_id);

-- Only the service role rolls these up. No user-facing INSERT policy.

-- ============================================================
-- 4. Intent routing log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dori_intent_routing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel TEXT,
  user_message_excerpt TEXT,
  classified_specialist TEXT NOT NULL,
  confidence NUMERIC,
  used_specialist TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dori_intent_routing_user_idx
  ON public.dori_intent_routing (user_id, created_at DESC);

ALTER TABLE public.dori_intent_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own routing log"
  ON public.dori_intent_routing FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. Slip-risk view
-- ============================================================
-- Each open task gets a 0-1 score. The proactive-assistant joins on
-- this to surface "this is going to slip" reminders BEFORE the due
-- date, instead of only after it's already overdue.
CREATE OR REPLACE VIEW public.dori_slip_risk AS
SELECT
  t.id AS task_id,
  t.user_id,
  t.workspace_id,
  t.title,
  t.category,
  t.priority,
  t.due_date,
  COALESCE(s.on_time_rate, 0.7) AS user_on_time_rate,
  COALESCE(s.median_lead_hours, 24) AS expected_lead_hours,
  -- Risk = (1 - on_time_rate) scaled by how close the due date is.
  -- A task due in <12h with a chronically late user → risk near 1.
  -- A task due in 7d for a reliable user → risk near 0.
  CASE
    WHEN t.due_date IS NULL THEN 0
    WHEN t.due_date < now() THEN 1.0
    ELSE LEAST(
      1.0,
      (1.0 - COALESCE(s.on_time_rate, 0.7)) *
      GREATEST(0.0, 1.0 - EXTRACT(EPOCH FROM (t.due_date - now())) / (COALESCE(s.median_lead_hours, 24) * 3600))
      + CASE WHEN t.priority = 'high' THEN 0.15 ELSE 0 END
    )
  END AS slip_risk
FROM public.tasks t
LEFT JOIN public.dori_task_stats s
  ON s.user_id = t.user_id
  AND s.category = t.category
  AND s.hour_bucket = -1
WHERE t.completed = false
  AND t.trashed = false;

GRANT SELECT ON public.dori_slip_risk TO authenticated, service_role;

COMMENT ON VIEW public.dori_slip_risk IS
  'Per-open-task slip-risk score (0-1). Computed from the user''s historical on-time rate and the time-to-due. The proactive-assistant uses this to surface at-risk tasks BEFORE they go overdue.';
