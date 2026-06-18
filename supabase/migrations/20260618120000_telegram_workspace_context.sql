-- Telegram workspace context and per-chat short-term state.
--
-- The Telegram assistant has distinct private, family-group, and workspace
-- group contexts. Older constraints only allowed tg_private/tg_family, and
-- dori_conversation_state keyed by (user_id, channel), which could leak
-- follow-up state between separate Telegram chats.

ALTER TABLE public.dori_conversations
  DROP CONSTRAINT IF EXISTS dori_conversations_channel_check;

ALTER TABLE public.dori_conversations
  ADD CONSTRAINT dori_conversations_channel_check
  CHECK (channel IN ('web', 'tg_private', 'tg_family', 'tg_workspace', 'voice'));

CREATE INDEX IF NOT EXISTS idx_dori_conv_channel_ref
  ON public.dori_conversations (user_id, channel, channel_ref, created_at DESC);

ALTER TABLE public.dori_conversation_state
  DROP CONSTRAINT IF EXISTS dori_conversation_state_channel_check;

ALTER TABLE public.dori_conversation_state
  ADD CONSTRAINT dori_conversation_state_channel_check
  CHECK (channel IN ('web', 'tg_private', 'tg_family', 'tg_workspace', 'voice'));

ALTER TABLE public.dori_conversation_state
  ADD COLUMN IF NOT EXISTS channel_ref TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS workspace_id UUID;

ALTER TABLE public.dori_conversation_state
  DROP CONSTRAINT IF EXISTS dori_conversation_state_pkey;

ALTER TABLE public.dori_conversation_state
  ADD CONSTRAINT dori_conversation_state_pkey
  PRIMARY KEY (user_id, channel, channel_ref);

CREATE INDEX IF NOT EXISTS dori_conversation_state_scope_idx
  ON public.dori_conversation_state (user_id, channel, channel_ref, workspace_id);

COMMENT ON COLUMN public.dori_conversation_state.channel_ref IS
  'Surface-specific conversation reference, e.g. Telegram chat_id. Empty string for web/global state.';
