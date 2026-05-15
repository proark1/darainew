-- Re-assert the columns the chat / telegram surfaces write to on
-- auto_actions_log, and force PostgREST to reload its schema cache.
--
-- Symptom that prompted this:
--   chat function -> insert into auto_actions_log -> PostgREST returned
--   "Could not find the 'expires_at' column of 'auto_actions_log' in the
--   schema cache", which surfaces in Telegram as "Could not queue: ...".
--
-- expires_at, source and source_ref were added by earlier migrations
-- (20260424120000_dori_action_confirmations and 20260424180000_dori_telegram_richer_ux),
-- but PostgREST's in-memory schema cache can outlive an ALTER TABLE if the
-- migration ran without a cache-reload signal. The ADD COLUMN IF NOT EXISTS
-- statements below are no-ops if the columns are already present; the NOTIFY
-- at the bottom is the actual fix for the reported error.

ALTER TABLE public.auto_actions_log
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Tell PostgREST to reload its schema cache so the newly-visible columns
-- become writable through the REST API immediately.
NOTIFY pgrst, 'reload schema';
