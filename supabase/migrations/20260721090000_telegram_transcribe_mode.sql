-- One-shot "transcript only" arm for Telegram voice notes.
--
-- A plain voice note is transcribed AND acted on by Dori. Sending a bare
-- /transcript (or /transkript) instead arms this row: the next voice note that
-- person sends in that chat is only transcribed back as text, no action taken.
-- The arm is consumed on first use and expires on its own, so a forgotten
-- /transcript never silently swallows a later command.
--
-- Keyed per (chat_id, telegram_user_id) so one member arming it in a family
-- group does not mute everybody else's voice notes.
-- Service-role only, same lockdown as telegram_bot_state.

CREATE TABLE IF NOT EXISTS public.telegram_transcribe_mode (
  chat_id bigint NOT NULL,
  telegram_user_id bigint NOT NULL,
  armed_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, telegram_user_id)
);

ALTER TABLE public.telegram_transcribe_mode ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_only_telegram_transcribe_mode" ON public.telegram_transcribe_mode;
CREATE POLICY "service_only_telegram_transcribe_mode" ON public.telegram_transcribe_mode
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS telegram_transcribe_mode_expiry_idx
  ON public.telegram_transcribe_mode (armed_until);

GRANT ALL ON public.telegram_transcribe_mode TO service_role;
