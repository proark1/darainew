-- Richer Telegram assistant UX: action TTL, undo window, tracked mutations.

-- 1) Give queued actions an explicit expiry so a user ignoring a confirmation
--    doesn't leave ghost rows forever. The Telegram/web surfaces refuse to
--    execute expired entries and hide them from the inbox.
ALTER TABLE public.auto_actions_log
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Back-fill: anything currently pending gets 24h from its creation.
UPDATE public.auto_actions_log
   SET expires_at = created_at + interval '24 hours'
 WHERE expires_at IS NULL;

COMMENT ON COLUMN public.auto_actions_log.expires_at IS
  'When a pending action should stop being actionable. NULL for legacy rows; new rows default to created_at + 24h.';

CREATE INDEX IF NOT EXISTS auto_actions_log_pending_expiry_idx
  ON public.auto_actions_log (user_id, status, expires_at DESC)
  WHERE status = 'pending';

-- 2) Record every mutation Dori executes so we can offer a one-tap undo for
--    a short window after the fact. Rows older than 5 minutes are never
--    shown as undoable, and the row is deleted the first time it is used.
CREATE TABLE IF NOT EXISTS public.dori_undo_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  -- 'create' | 'update' | 'delete' | 'complete'
  op text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,                        -- row id in the target table when available
  label text NOT NULL,                   -- human-readable, e.g. "Delete task: Buy milk"
  -- Full inverse tool-XML, when we can reconstruct one. NULL means "not undoable"
  -- (e.g. irreversible external side effects).
  inverse_tool_xml text,
  -- Snapshot of the affected row(s) BEFORE the mutation, for restoring deletes / updates.
  snapshot jsonb,
  source text NOT NULL DEFAULT 'web',
  source_ref text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

ALTER TABLE public.dori_undo_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own undo rows"
  ON public.dori_undo_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages undo rows"
  ON public.dori_undo_log FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS dori_undo_log_user_recent_idx
  ON public.dori_undo_log (user_id, created_at DESC)
  WHERE consumed_at IS NULL;

COMMENT ON TABLE public.dori_undo_log IS
  'Short-lived record of each mutation Dori performed so the user can undo it via an inline button or /undo within a few minutes.';
