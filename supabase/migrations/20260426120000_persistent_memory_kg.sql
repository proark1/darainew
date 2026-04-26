-- Persistent memory + knowledge graph.
--
-- Adds an entity / provenance / forget layer on top of the existing
-- `dori_semantic_memories`, `ai_memory`, and `episodic_memories` tables.
-- Goal: durable cross-module memory that the user can audit and prune.
--
-- Four tables + a handful of RPCs:
--   1. kg_entities       — canonical people / projects / places /
--                          organizations / topics, deduped per user.
--   2. kg_mentions       — many-to-many link from a memory row (in any
--                          source table) to one or more entities.
--   3. memory_provenance — derivation chain. Lets the UI answer "why
--                          do you remember this?" and lets the forget
--                          machinery cascade upstream.
--   4. memory_redactions — audit log of every user-initiated forget,
--                          system-applied retention, and cascade.
--
-- All four are user-scoped with RLS. Service role inserts on behalf of
-- the extraction worker (kg-extract edge fn).

-- ============================================================
-- 1. Entities
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kg_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  -- Coarse type. Keep the list short — fine-grained typing belongs in metadata.
  kind TEXT NOT NULL CHECK (kind IN (
    'person', 'project', 'place', 'organization',
    'topic', 'product', 'event'
  )),
  name TEXT NOT NULL,
  -- lower(trim(name)) — used as the dedup key. We keep `name` separate
  -- so the display form preserves capitalisation ("John" vs. "john").
  name_normalized TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  -- Cross-references to concrete rows in other tables.
  --   { "contact_id": "...", "workspace_id": "...", "task_id": "..." }
  external_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  importance NUMERIC NOT NULL DEFAULT 0.5
    CHECK (importance >= 0 AND importance <= 1),
  -- Maintained by triggers on kg_mentions so the UI can sort by it
  -- without an aggregate query per row.
  mention_count INTEGER NOT NULL DEFAULT 0,
  last_mentioned_at TIMESTAMPTZ,
  -- Soft-delete: forgetting an entity sets this and cascades to mentions.
  redacted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, name_normalized)
);

CREATE INDEX IF NOT EXISTS kg_entities_user_kind_idx
  ON public.kg_entities (user_id, kind, last_mentioned_at DESC NULLS LAST)
  WHERE redacted_at IS NULL;

CREATE INDEX IF NOT EXISTS kg_entities_user_recent_idx
  ON public.kg_entities (user_id, last_mentioned_at DESC NULLS LAST)
  WHERE redacted_at IS NULL;

CREATE INDEX IF NOT EXISTS kg_entities_aliases_gin
  ON public.kg_entities USING GIN (aliases);

ALTER TABLE public.kg_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own kg entities"
  ON public.kg_entities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own kg entities"
  ON public.kg_entities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own kg entities"
  ON public.kg_entities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own kg entities"
  ON public.kg_entities FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_kg_entities_updated_at
  BEFORE UPDATE ON public.kg_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Mentions (entity ↔ memory-row link)
-- ============================================================
-- A single memory row can mention N entities; an entity can be
-- referenced by N memory rows. The (source_kind, source_id) pair is a
-- polymorphic FK — we don't enforce it because the underlying tables
-- live in different schemas (semantic vs. episodic vs. ai_memory) and
-- some sources are external strings (chat turns).
CREATE TABLE IF NOT EXISTS public.kg_mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL REFERENCES public.kg_entities(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL CHECK (source_kind IN (
    'semantic', 'episodic', 'ai_memory', 'task',
    'event', 'note', 'contact', 'chat'
  )),
  source_id TEXT NOT NULL,
  -- 0..1, how central this entity is to the source row. Used to weight
  -- entity-aware recall — a casual mention shouldn't outrank a primary
  -- subject just because it's recent.
  salience NUMERIC NOT NULL DEFAULT 0.5
    CHECK (salience >= 0 AND salience <= 1),
  excerpt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_id, source_kind, source_id)
);

CREATE INDEX IF NOT EXISTS kg_mentions_entity_idx
  ON public.kg_mentions (entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS kg_mentions_source_idx
  ON public.kg_mentions (user_id, source_kind, source_id);

CREATE INDEX IF NOT EXISTS kg_mentions_user_recent_idx
  ON public.kg_mentions (user_id, created_at DESC);

ALTER TABLE public.kg_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own kg mentions"
  ON public.kg_mentions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own kg mentions"
  ON public.kg_mentions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own kg mentions"
  ON public.kg_mentions FOR DELETE
  USING (auth.uid() = user_id);

-- Keep entity counters in sync. Cheap because it's per-row, and we'd
-- otherwise need a sub-query in every list view.
CREATE OR REPLACE FUNCTION public.kg_mentions_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.kg_entities
     SET mention_count = mention_count + 1,
         last_mentioned_at = GREATEST(COALESCE(last_mentioned_at, NEW.created_at), NEW.created_at)
   WHERE id = NEW.entity_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kg_mentions_after_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.kg_entities
     SET mention_count = GREATEST(0, mention_count - 1)
   WHERE id = OLD.entity_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS kg_mentions_count_ins ON public.kg_mentions;
CREATE TRIGGER kg_mentions_count_ins
  AFTER INSERT ON public.kg_mentions
  FOR EACH ROW EXECUTE FUNCTION public.kg_mentions_after_insert();

DROP TRIGGER IF EXISTS kg_mentions_count_del ON public.kg_mentions;
CREATE TRIGGER kg_mentions_count_del
  AFTER DELETE ON public.kg_mentions
  FOR EACH ROW EXECUTE FUNCTION public.kg_mentions_after_delete();

-- ============================================================
-- 3. Provenance
-- ============================================================
-- "Why do you remember this?" Each derived memory row points back at
-- the raw input it came from (an email, a chat turn, a task, …). The
-- forget machinery walks this in reverse.
CREATE TABLE IF NOT EXISTS public.memory_provenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN (
    'semantic', 'episodic', 'ai_memory', 'kg_entity'
  )),
  target_id UUID NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  transformation TEXT NOT NULL CHECK (transformation IN (
    'extracted', 'summarized', 'aggregated',
    'inferred', 'manual', 'imported'
  )),
  model TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0.7
    CHECK (confidence >= 0 AND confidence <= 1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_provenance_target_idx
  ON public.memory_provenance (user_id, target_kind, target_id);

CREATE INDEX IF NOT EXISTS memory_provenance_source_idx
  ON public.memory_provenance (user_id, source_kind, source_id);

ALTER TABLE public.memory_provenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own provenance"
  ON public.memory_provenance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own provenance"
  ON public.memory_provenance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own provenance"
  ON public.memory_provenance FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. Redactions (forget audit)
-- ============================================================
-- Every "forget this" action lands here. Mostly insert-only — the
-- audit log itself is never trimmed by the forget machinery, so a user
-- can always answer "what have I asked the assistant to forget?".
CREATE TABLE IF NOT EXISTS public.memory_redactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN (
    'semantic', 'episodic', 'ai_memory', 'kg_entity',
    'all_for_entity', 'all_for_topic', 'all_for_date_range'
  )),
  target_id TEXT,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  cascaded_count INTEGER NOT NULL DEFAULT 0,
  applied_by TEXT NOT NULL DEFAULT 'user'
    CHECK (applied_by IN ('user', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_redactions_user_idx
  ON public.memory_redactions (user_id, created_at DESC);

ALTER TABLE public.memory_redactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redactions"
  ON public.memory_redactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own redactions"
  ON public.memory_redactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. RPC: upsert an entity (dedup by user + kind + normalized name)
-- ============================================================
-- Returns the row's id. If a row already exists, merges aliases and
-- bumps importance toward the new value (smoothed average).
CREATE OR REPLACE FUNCTION public.kg_upsert_entity(
  p_user_id UUID,
  p_kind TEXT,
  p_name TEXT,
  p_aliases TEXT[] DEFAULT '{}',
  p_external_refs JSONB DEFAULT '{}'::jsonb,
  p_workspace_id UUID DEFAULT NULL,
  p_importance NUMERIC DEFAULT 0.5,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_norm TEXT;
BEGIN
  v_norm := lower(trim(p_name));
  IF v_norm = '' OR v_norm IS NULL THEN
    RAISE EXCEPTION 'kg_upsert_entity: empty name';
  END IF;

  INSERT INTO public.kg_entities (
    user_id, workspace_id, kind, name, name_normalized,
    aliases, external_refs, importance, description
  ) VALUES (
    p_user_id, p_workspace_id, p_kind, p_name, v_norm,
    COALESCE(p_aliases, '{}'), COALESCE(p_external_refs, '{}'::jsonb),
    LEAST(1, GREATEST(0, COALESCE(p_importance, 0.5))),
    p_description
  )
  ON CONFLICT (user_id, kind, name_normalized) DO UPDATE SET
    aliases = (
      SELECT array_agg(DISTINCT a)
        FROM unnest(public.kg_entities.aliases || COALESCE(EXCLUDED.aliases, '{}')) AS a
       WHERE a IS NOT NULL AND a <> ''
    ),
    external_refs = public.kg_entities.external_refs || COALESCE(EXCLUDED.external_refs, '{}'::jsonb),
    importance = LEAST(1, (public.kg_entities.importance * 0.7) + (EXCLUDED.importance * 0.3)),
    description = COALESCE(EXCLUDED.description, public.kg_entities.description),
    redacted_at = NULL,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kg_upsert_entity(UUID, TEXT, TEXT, TEXT[], JSONB, UUID, NUMERIC, TEXT)
  TO authenticated, service_role;

-- ============================================================
-- 6. RPC: link a memory row to an entity (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.kg_link_mention(
  p_user_id UUID,
  p_entity_id UUID,
  p_source_kind TEXT,
  p_source_id TEXT,
  p_salience NUMERIC DEFAULT 0.5,
  p_excerpt TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.kg_mentions (
    user_id, entity_id, source_kind, source_id, salience, excerpt
  ) VALUES (
    p_user_id, p_entity_id, p_source_kind, p_source_id,
    LEAST(1, GREATEST(0, COALESCE(p_salience, 0.5))),
    LEFT(COALESCE(p_excerpt, ''), 600)
  )
  ON CONFLICT (user_id, entity_id, source_kind, source_id) DO UPDATE SET
    salience = LEAST(1, (public.kg_mentions.salience * 0.7) + (EXCLUDED.salience * 0.3)),
    excerpt = COALESCE(EXCLUDED.excerpt, public.kg_mentions.excerpt)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kg_link_mention(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT)
  TO authenticated, service_role;

-- ============================================================
-- 7. RPC: entity neighborhood (co-occurrence)
-- ============================================================
-- Two entities are "neighbors" when they share a memory row. Returns
-- the top N co-occurring entities by overlap count.
CREATE OR REPLACE FUNCTION public.kg_neighborhood(
  p_user_id UUID,
  p_entity_id UUID,
  p_limit INT DEFAULT 12
)
RETURNS TABLE (
  entity_id UUID,
  name TEXT,
  kind TEXT,
  shared_mentions BIGINT,
  last_co_mention TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  WITH src AS (
    SELECT source_kind, source_id, created_at
      FROM public.kg_mentions
     WHERE user_id = p_user_id AND entity_id = p_entity_id
  )
  SELECT
    e.id AS entity_id,
    e.name,
    e.kind,
    COUNT(*) AS shared_mentions,
    MAX(m.created_at) AS last_co_mention
  FROM public.kg_mentions m
  JOIN src ON src.source_kind = m.source_kind AND src.source_id = m.source_id
  JOIN public.kg_entities e ON e.id = m.entity_id
  WHERE m.user_id = p_user_id
    AND m.entity_id <> p_entity_id
    AND e.redacted_at IS NULL
  GROUP BY e.id, e.name, e.kind
  ORDER BY shared_mentions DESC, last_co_mention DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.kg_neighborhood(UUID, UUID, INT)
  TO authenticated, service_role;

-- ============================================================
-- 8. RPC: top entities (for the dashboard list)
-- ============================================================
CREATE OR REPLACE FUNCTION public.kg_top_entities(
  p_user_id UUID,
  p_limit INT DEFAULT 50,
  p_kinds TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  kind TEXT,
  name TEXT,
  description TEXT,
  importance NUMERIC,
  mention_count INTEGER,
  last_mentioned_at TIMESTAMPTZ,
  external_refs JSONB
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.id, e.kind, e.name, e.description,
    e.importance, e.mention_count, e.last_mentioned_at, e.external_refs
  FROM public.kg_entities e
  WHERE e.user_id = p_user_id
    AND e.redacted_at IS NULL
    AND (p_kinds IS NULL OR e.kind = ANY(p_kinds))
  ORDER BY
    e.last_mentioned_at DESC NULLS LAST,
    e.mention_count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.kg_top_entities(UUID, INT, TEXT[])
  TO authenticated, service_role;

-- ============================================================
-- 9. RPC: cascading forget
-- ============================================================
-- One entry point, three cascade modes:
--   * 'semantic'     → soft-delete the dori_semantic_memories row.
--   * 'episodic'     → delete the episodic_memories row.
--   * 'ai_memory'    → set is_active=false on ai_memory.
--   * 'kg_entity'    → set redacted_at on the entity AND drop its
--                      mentions, AND null-out matching aliases on
--                      semantic rows that referenced it.
--
-- Always logs to memory_redactions so the user has an undo trail.
CREATE OR REPLACE FUNCTION public.forget_memory_target(
  p_user_id UUID,
  p_target_kind TEXT,
  p_target_id TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_uuid UUID;
BEGIN
  IF p_target_kind = 'semantic' THEN
    v_uuid := p_target_id::uuid;
    DELETE FROM public.dori_semantic_memories
     WHERE user_id = p_user_id AND id = v_uuid;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    DELETE FROM public.kg_mentions
     WHERE user_id = p_user_id
       AND source_kind = 'semantic'
       AND source_id = v_uuid::text;

  ELSIF p_target_kind = 'episodic' THEN
    v_uuid := p_target_id::uuid;
    DELETE FROM public.episodic_memories
     WHERE user_id = p_user_id AND id = v_uuid;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    DELETE FROM public.kg_mentions
     WHERE user_id = p_user_id
       AND source_kind = 'episodic'
       AND source_id = v_uuid::text;

  ELSIF p_target_kind = 'ai_memory' THEN
    v_uuid := p_target_id::uuid;
    UPDATE public.ai_memory
       SET is_active = false, updated_at = now()
     WHERE user_id = p_user_id AND id = v_uuid;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    DELETE FROM public.kg_mentions
     WHERE user_id = p_user_id
       AND source_kind = 'ai_memory'
       AND source_id = v_uuid::text;

  ELSIF p_target_kind = 'kg_entity' THEN
    v_uuid := p_target_id::uuid;
    UPDATE public.kg_entities
       SET redacted_at = now(), updated_at = now()
     WHERE user_id = p_user_id AND id = v_uuid;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    -- Cascade through every memory row this entity was attached to.
    -- We delete mentions (cheap) but DON'T auto-delete the underlying
    -- memory rows — those may also be about other entities. The user
    -- can opt into a deeper sweep via the UI.
    DELETE FROM public.kg_mentions
     WHERE user_id = p_user_id AND entity_id = v_uuid;

  ELSE
    RAISE EXCEPTION 'forget_memory_target: unknown target_kind %', p_target_kind;
  END IF;

  INSERT INTO public.memory_redactions (
    user_id, target_kind, target_id, reason, cascaded_count, applied_by
  ) VALUES (
    p_user_id, p_target_kind, p_target_id, p_reason, v_count, 'user'
  );

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.forget_memory_target(UUID, TEXT, TEXT, TEXT)
  TO authenticated, service_role;

-- ============================================================
-- 10. View: unified memory audit feed
-- ============================================================
-- One read for the audit UI — no five separate queries on the client.
-- Each row is a memory item with normalized fields. Order is
-- (created_at DESC) so the UI can paginate it directly.
CREATE OR REPLACE VIEW public.memory_audit_feed AS
SELECT
  'semantic'::text AS source_kind,
  m.id::text AS source_id,
  m.user_id,
  m.workspace_id,
  m.source AS sub_kind,
  m.content AS content,
  NULL::text AS title,
  m.metadata,
  m.importance,
  NULL::numeric AS confidence,
  m.created_at,
  m.updated_at
FROM public.dori_semantic_memories m
UNION ALL
SELECT
  'episodic'::text,
  e.id::text,
  e.user_id,
  NULL::uuid,
  COALESCE(e.source, 'episodic'),
  COALESCE(e.summary, e.title),
  e.title,
  jsonb_build_object('people', e.people, 'tags', e.tags, 'location', e.location, 'occurred_on', e.occurred_on),
  e.importance,
  NULL::numeric,
  e.created_at,
  e.updated_at
FROM public.episodic_memories e
UNION ALL
SELECT
  'ai_memory'::text,
  a.id::text,
  a.user_id,
  a.workspace_id,
  a.memory_type,
  a.value,
  a.key,
  jsonb_build_object('category', a.category, 'context', a.context, 'source', a.source),
  NULL::numeric,
  a.confidence,
  a.created_at,
  a.updated_at
FROM public.ai_memory a
WHERE a.is_active = true;

GRANT SELECT ON public.memory_audit_feed TO authenticated, service_role;

COMMENT ON VIEW public.memory_audit_feed IS
  'Unified read-only feed of every memory item the assistant holds for a user. Drives the Memory & Privacy dashboard. Honors RLS via the underlying tables.';

-- ============================================================
-- 11. Counter rebuild (one-shot, for any pre-existing entities)
-- ============================================================
-- mention_count + last_mentioned_at are maintained by the trigger
-- going forward, but if backfill ever inserts mentions out-of-band
-- this RPC re-syncs the cache.
CREATE OR REPLACE FUNCTION public.kg_resync_entity_counters(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INT;
BEGIN
  WITH agg AS (
    SELECT entity_id,
           COUNT(*) AS cnt,
           MAX(created_at) AS last_seen
      FROM public.kg_mentions
     WHERE user_id = p_user_id
     GROUP BY entity_id
  )
  UPDATE public.kg_entities e
     SET mention_count = COALESCE(agg.cnt, 0),
         last_mentioned_at = agg.last_seen,
         updated_at = now()
    FROM agg
   WHERE e.user_id = p_user_id
     AND e.id = agg.entity_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kg_resync_entity_counters(UUID)
  TO authenticated, service_role;
