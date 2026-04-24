-- Per-action-type confirmation preferences for the Dori assistant.
-- Lets each user decide whether Dori should ask for acknowledgment before
-- creating, editing, or deleting anything on their behalf (and override
-- that decision per module). Also tracks where a pending action came from
-- so the Telegram bot can ping the right chat when approval arrives.

ALTER TABLE public.proactive_settings
  ADD COLUMN IF NOT EXISTS require_action_confirmation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS confirm_creates boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirm_updates boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS confirm_deletes boolean NOT NULL DEFAULT true,
  -- Per-entity overrides: { "task": { "delete": false }, "contract": { "create": true } }
  ADD COLUMN IF NOT EXISTS confirmation_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.proactive_settings.require_action_confirmation IS
  'Master toggle. When false, Dori auto-executes every action without asking.';
COMMENT ON COLUMN public.proactive_settings.confirm_creates IS
  'If true, Dori asks before creating (adding) anything.';
COMMENT ON COLUMN public.proactive_settings.confirm_updates IS
  'If true, Dori asks before editing any existing item.';
COMMENT ON COLUMN public.proactive_settings.confirm_deletes IS
  'If true, Dori asks before deleting any item.';
COMMENT ON COLUMN public.proactive_settings.confirmation_overrides IS
  'Per-module overrides of confirm_creates/updates/deletes, shape: {"<entity>":{"create":bool,"update":bool,"delete":bool}}';

ALTER TABLE public.auto_actions_log
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS source_ref text;

COMMENT ON COLUMN public.auto_actions_log.source IS
  'Surface that queued the action: "web" | "tg_private" | "tg_family" | "voice" | "proactive".';
COMMENT ON COLUMN public.auto_actions_log.source_ref IS
  'Surface-specific reference (e.g. Telegram chat_id) so the originating surface can be notified on approval/rejection.';

CREATE INDEX IF NOT EXISTS auto_actions_log_user_status_created_idx
  ON public.auto_actions_log (user_id, status, created_at DESC);
