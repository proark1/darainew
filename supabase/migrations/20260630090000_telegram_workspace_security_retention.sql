-- Telegram workspace setup and safer intake storage.
--
-- Workspace Telegram links need a pending state: an app admin generates a
-- one-time code before the bot knows the target group chat_id.
ALTER TABLE public.workspace_telegram_links
  ALTER COLUMN chat_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_telegram_links_chat_id_active_idx
  ON public.workspace_telegram_links (chat_id)
  WHERE chat_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_telegram_links_link_code_idx
  ON public.workspace_telegram_links (link_code)
  WHERE link_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS workspace_telegram_links_pending_idx
  ON public.workspace_telegram_links (workspace_id, link_code_expires_at)
  WHERE is_active = false AND link_code IS NOT NULL;

ALTER TABLE public.workspace_telegram_links
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_workspace_telegram_links_updated_at
  ON public.workspace_telegram_links;
CREATE TRIGGER update_workspace_telegram_links_updated_at
  BEFORE UPDATE ON public.workspace_telegram_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Keep raw Telegram payloads optional and short-lived. The sanitized copy is
-- enough for diagnostics/conversation context without retaining full Telegram
-- user/file metadata indefinitely.
ALTER TABLE public.telegram_messages
  ALTER COLUMN raw_update DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS sanitized_update jsonb,
  ADD COLUMN IF NOT EXISTS raw_update_expires_at timestamptz;

UPDATE public.telegram_messages
   SET raw_update_expires_at = COALESCE(raw_update_expires_at, created_at + interval '14 days')
 WHERE raw_update IS NOT NULL;

CREATE INDEX IF NOT EXISTS telegram_messages_raw_expiry_idx
  ON public.telegram_messages (raw_update_expires_at)
  WHERE raw_update IS NOT NULL;

-- Persist voice transcripts separately from the raw Telegram update so users
-- can debug "what did Dori hear?" without keeping the original payload.
CREATE TABLE IF NOT EXISTS public.telegram_voice_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id bigint,
  chat_id bigint NOT NULL,
  telegram_user_id bigint,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transcript text NOT NULL,
  language text,
  confidence numeric,
  provider text,
  duration_seconds integer,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_voice_transcripts_user_idx
  ON public.telegram_voice_transcripts (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS telegram_voice_transcripts_chat_idx
  ON public.telegram_voice_transcripts (chat_id, created_at DESC);

ALTER TABLE public.telegram_voice_transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_only_telegram_voice_transcripts"
  ON public.telegram_voice_transcripts;
CREATE POLICY "service_only_telegram_voice_transcripts"
  ON public.telegram_voice_transcripts
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');
