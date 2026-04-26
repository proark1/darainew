-- Durable agentic execution loop.
--
-- Adds first-class persistence to the multi-step "propose_plan" flow that
-- the chat function emits today. Until now, the plan lived only in
-- conversation state and died on refresh; from this migration on, plans
-- are real rows that survive refreshes, expose progress to the user,
-- and gate every step behind explicit approval.
--
-- Two new tables:
--   1. dori_action_plans — one row per plan. Tracks lifecycle (draft →
--                          awaiting_confirm → running → completed/aborted/failed).
--   2. dori_plan_steps   — ordered steps inside a plan. Each step holds
--                          the goal text the executor will hand to the
--                          chat agent, plus its own status + result +
--                          undo back-reference.
--
-- Plus an additive ALTER on auto_actions_log: a plan_id + plan_step_id
-- back-reference so single-action audit rows can be associated with the
-- plan they came from. This lets the existing AgentActionInbox and
-- Telegram inline confirm flow keep working unchanged for one-off
-- actions while the new PlansPanel handles plan-aware UX.

-- ============================================================
-- 1. Plans
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dori_action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  -- Originating channel — useful for routing follow-up confirms back to
  -- the same surface (Telegram inline keyboard vs. web sheet).
  channel TEXT NOT NULL DEFAULT 'web'
    CHECK (channel IN ('web', 'tg_private', 'tg_family', 'voice', 'auto_pilot')),
  source TEXT NOT NULL DEFAULT 'chat'
    CHECK (source IN ('chat', 'auto_pilot', 'manual', 'recap')),
  title TEXT NOT NULL,
  description TEXT,
  -- Lifecycle:
  --   draft           → not yet shown to the user.
  --   awaiting_confirm → user has the plan; first step is gated.
  --   running         → a step is executing right now.
  --   paused          → user explicitly paused; resumable.
  --   completed       → all steps succeeded (or skipped).
  --   aborted         → user aborted mid-flight.
  --   failed          → a step failed and `auto_continue_on_fail` was off.
  status TEXT NOT NULL DEFAULT 'awaiting_confirm'
    CHECK (status IN (
      'draft', 'awaiting_confirm', 'running',
      'paused', 'completed', 'aborted', 'failed'
    )),
  step_count INTEGER NOT NULL DEFAULT 0,
  completed_step_count INTEGER NOT NULL DEFAULT 0,
  -- Index of the next step to act on (idx in dori_plan_steps). NULL
  -- means "no more pending steps".
  current_step_idx INTEGER,
  -- Plans expire after a long but bounded window so abandoned ones
  -- don't accumulate in the inbox forever. The chat function clears
  -- expired ones lazily.
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  completed_at TIMESTAMPTZ,
  aborted_at TIMESTAMPTZ,
  -- Free-form metadata (specialist that proposed, originating message
  -- id, …). Don't put PII or tool args here — those go in steps.
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dori_action_plans_user_active_idx
  ON public.dori_action_plans (user_id, updated_at DESC)
  WHERE status NOT IN ('completed', 'aborted', 'failed');

CREATE INDEX IF NOT EXISTS dori_action_plans_user_recent_idx
  ON public.dori_action_plans (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dori_action_plans_expiry_idx
  ON public.dori_action_plans (expires_at)
  WHERE status NOT IN ('completed', 'aborted', 'failed');

ALTER TABLE public.dori_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own plans"
  ON public.dori_action_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own plans"
  ON public.dori_action_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own plans"
  ON public.dori_action_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own plans"
  ON public.dori_action_plans FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_dori_action_plans_updated_at
  BEFORE UPDATE ON public.dori_action_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Plan steps
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dori_plan_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.dori_action_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  -- 0-based ordinal. Unique within a plan.
  idx INTEGER NOT NULL,
  title TEXT NOT NULL,
  -- Natural-language goal that the executor passes to the chat agent
  -- as "Now do: <description>". The agent picks the right tool. We
  -- specifically DON'T pre-bake tool_xml here so the executor can
  -- adapt to context it didn't have at plan-time (e.g. a contact id
  -- that became known after step 1).
  description TEXT,
  -- Optional pre-baked tool_xml. When present, the executor skips the
  -- agent round-trip and feeds it directly into chat's preformedToolText
  -- path. Useful for deterministic steps like "send this exact email".
  tool_hint TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'awaiting_confirm', 'running',
      'succeeded', 'failed', 'skipped', 'aborted'
    )),
  -- Per-step gating. Default true: every step requires explicit user
  -- approval. The auto_pilot caller can set false to chain trusted
  -- low-risk steps.
  requires_confirmation BOOLEAN NOT NULL DEFAULT true,
  result_summary TEXT,
  error_message TEXT,
  -- Back-reference into dori_undo_log so the UI can offer a per-step
  -- undo button without re-querying by entity_id.
  undo_log_id UUID,
  executed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, idx)
);

CREATE INDEX IF NOT EXISTS dori_plan_steps_plan_idx
  ON public.dori_plan_steps (plan_id, idx);

CREATE INDEX IF NOT EXISTS dori_plan_steps_user_pending_idx
  ON public.dori_plan_steps (user_id, plan_id)
  WHERE status IN ('pending', 'awaiting_confirm', 'running');

ALTER TABLE public.dori_plan_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own plan steps"
  ON public.dori_plan_steps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own plan steps"
  ON public.dori_plan_steps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own plan steps"
  ON public.dori_plan_steps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own plan steps"
  ON public.dori_plan_steps FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_dori_plan_steps_updated_at
  BEFORE UPDATE ON public.dori_plan_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. ALTER auto_actions_log: link to plan / step
-- ============================================================
-- One auto_actions_log row per executed step. The single-action approve
-- flow continues to work for non-plan actions (plan_id IS NULL).
ALTER TABLE public.auto_actions_log
  ADD COLUMN IF NOT EXISTS plan_id UUID
    REFERENCES public.dori_action_plans(id) ON DELETE SET NULL;
ALTER TABLE public.auto_actions_log
  ADD COLUMN IF NOT EXISTS plan_step_id UUID
    REFERENCES public.dori_plan_steps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS auto_actions_log_plan_idx
  ON public.auto_actions_log (plan_id)
  WHERE plan_id IS NOT NULL;

-- ============================================================
-- 4. RPC: create a plan from a JSON spec
-- ============================================================
-- Atomic create: one plan row + N step rows. p_steps is a JSON array;
-- each element is { title, description?, tool_hint?, requires_confirmation? }.
CREATE OR REPLACE FUNCTION public.dori_create_plan(
  p_user_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_steps JSONB,
  p_source TEXT DEFAULT 'chat',
  p_channel TEXT DEFAULT 'web',
  p_workspace_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_step_count INTEGER;
  v_step JSONB;
  v_idx INTEGER := 0;
  v_title TEXT;
BEGIN
  IF jsonb_typeof(p_steps) <> 'array' THEN
    RAISE EXCEPTION 'dori_create_plan: p_steps must be a JSON array';
  END IF;
  v_step_count := jsonb_array_length(p_steps);
  IF v_step_count = 0 THEN
    RAISE EXCEPTION 'dori_create_plan: at least one step required';
  END IF;
  IF v_step_count > 25 THEN
    -- Defense in depth — keeps a runaway model from filling the table.
    RAISE EXCEPTION 'dori_create_plan: too many steps (max 25)';
  END IF;

  INSERT INTO public.dori_action_plans (
    user_id, workspace_id, channel, source, title, description,
    status, step_count, current_step_idx, metadata
  ) VALUES (
    p_user_id, p_workspace_id, p_channel, p_source,
    LEFT(p_title, 200), LEFT(COALESCE(p_description, ''), 1000),
    'awaiting_confirm', v_step_count, 0,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_plan_id;

  FOR v_step IN SELECT * FROM jsonb_array_elements(p_steps)
  LOOP
    v_title := COALESCE(v_step->>'title', 'Step ' || (v_idx + 1));
    INSERT INTO public.dori_plan_steps (
      plan_id, user_id, idx, title, description, tool_hint, requires_confirmation, metadata
    ) VALUES (
      v_plan_id, p_user_id, v_idx,
      LEFT(v_title, 200),
      LEFT(COALESCE(v_step->>'description', ''), 1000),
      v_step->>'tool_hint',
      COALESCE((v_step->>'requires_confirmation')::boolean, true),
      COALESCE(v_step->'metadata', '{}'::jsonb)
    );
    v_idx := v_idx + 1;
  END LOOP;

  RETURN v_plan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dori_create_plan(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, JSONB)
  TO authenticated, service_role;

-- ============================================================
-- 5. RPC: cancel a plan
-- ============================================================
-- Sets the plan to 'aborted' and marks every still-open step as
-- 'aborted'. Idempotent — re-aborting a completed plan is a no-op.
CREATE OR REPLACE FUNCTION public.dori_cancel_plan(
  p_user_id UUID,
  p_plan_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_steps_changed INTEGER;
BEGIN
  UPDATE public.dori_action_plans
     SET status = 'aborted',
         aborted_at = now(),
         metadata = metadata || jsonb_build_object('abort_reason', p_reason),
         updated_at = now()
   WHERE id = p_plan_id
     AND user_id = p_user_id
     AND status NOT IN ('completed', 'aborted', 'failed');

  UPDATE public.dori_plan_steps
     SET status = 'aborted',
         updated_at = now()
   WHERE plan_id = p_plan_id
     AND user_id = p_user_id
     AND status IN ('pending', 'awaiting_confirm', 'running');
  GET DIAGNOSTICS v_steps_changed = ROW_COUNT;
  RETURN v_steps_changed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dori_cancel_plan(UUID, UUID, TEXT)
  TO authenticated, service_role;

-- ============================================================
-- 6. RPC: skip current step
-- ============================================================
-- Marks the current pending/awaiting_confirm step as skipped, advances
-- the plan, and returns the new state JSON (so the caller can render
-- without a follow-up SELECT).
CREATE OR REPLACE FUNCTION public.dori_skip_current_step(
  p_user_id UUID,
  p_plan_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step_id UUID;
  v_idx INTEGER;
  v_completed INTEGER;
  v_total INTEGER;
  v_next_idx INTEGER;
  v_plan_status TEXT;
BEGIN
  SELECT id, idx INTO v_step_id, v_idx
    FROM public.dori_plan_steps
   WHERE plan_id = p_plan_id
     AND user_id = p_user_id
     AND status IN ('pending', 'awaiting_confirm', 'running')
   ORDER BY idx
   LIMIT 1;

  IF v_step_id IS NULL THEN
    RETURN jsonb_build_object('skipped', false, 'reason', 'no pending step');
  END IF;

  UPDATE public.dori_plan_steps
     SET status = 'skipped',
         result_summary = COALESCE(p_reason, 'skipped by user'),
         executed_at = now(),
         updated_at = now()
   WHERE id = v_step_id;

  -- Recompute counters + figure out next step.
  SELECT COUNT(*) FILTER (
           WHERE status IN ('succeeded', 'skipped')
         ),
         COUNT(*),
         MIN(idx) FILTER (
           WHERE status IN ('pending', 'awaiting_confirm')
         )
    INTO v_completed, v_total, v_next_idx
    FROM public.dori_plan_steps
   WHERE plan_id = p_plan_id;

  v_plan_status := CASE
    WHEN v_next_idx IS NULL THEN 'completed'
    ELSE 'awaiting_confirm'
  END;

  UPDATE public.dori_action_plans
     SET completed_step_count = v_completed,
         current_step_idx = v_next_idx,
         status = v_plan_status,
         completed_at = CASE WHEN v_plan_status = 'completed' THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'skipped', true,
    'step_id', v_step_id,
    'next_step_idx', v_next_idx,
    'plan_status', v_plan_status,
    'completed_step_count', v_completed,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dori_skip_current_step(UUID, UUID, TEXT)
  TO authenticated, service_role;

-- ============================================================
-- 7. View: active plans for the inbox
-- ============================================================
CREATE OR REPLACE VIEW public.dori_active_plans AS
SELECT
  p.id,
  p.user_id,
  p.workspace_id,
  p.channel,
  p.source,
  p.title,
  p.description,
  p.status,
  p.step_count,
  p.completed_step_count,
  p.current_step_idx,
  p.expires_at,
  p.completed_at,
  p.aborted_at,
  p.metadata,
  p.created_at,
  p.updated_at,
  -- The "current" step row, embedded so the inbox can render the next
  -- action without a follow-up query per plan.
  (
    SELECT jsonb_build_object(
      'id', s.id,
      'idx', s.idx,
      'title', s.title,
      'description', s.description,
      'status', s.status,
      'requires_confirmation', s.requires_confirmation,
      'result_summary', s.result_summary,
      'error_message', s.error_message
    )
    FROM public.dori_plan_steps s
    WHERE s.plan_id = p.id
      AND s.idx = COALESCE(p.current_step_idx, 0)
    LIMIT 1
  ) AS current_step
FROM public.dori_action_plans p
WHERE p.status NOT IN ('completed', 'aborted', 'failed')
   OR p.updated_at > now() - interval '24 hours';

GRANT SELECT ON public.dori_active_plans TO authenticated, service_role;

COMMENT ON VIEW public.dori_active_plans IS
  'Plans the inbox should surface. Includes anything still in flight, plus recently-finished plans for the last 24h so users can review what just happened.';
