CREATE TABLE IF NOT EXISTS public.telegram_assistant_replies (
  id BIGSERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  reply TEXT NOT NULL,
  in_response_to_update_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_assistant_replies_chat_created
  ON public.telegram_assistant_replies (chat_id, created_at DESC);

ALTER TABLE public.telegram_assistant_replies ENABLE ROW LEVEL SECURITY;

-- Service role only — no public access. Edge functions use service key.
CREATE POLICY "Service role manages assistant replies"
  ON public.telegram_assistant_replies
  FOR ALL
  USING (false)
  WITH CHECK (false);