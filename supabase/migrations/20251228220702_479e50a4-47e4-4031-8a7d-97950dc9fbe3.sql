-- Pinned messages
CREATE TABLE IF NOT EXISTS public.pinned_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('direct', 'group')),
  pinned_by uuid NOT NULL,
  chat_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, message_type)
);

-- Starred messages
CREATE TABLE IF NOT EXISTS public.starred_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_id uuid NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('direct', 'group')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id, message_type)
);

-- Scheduled messages
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid,
  group_id uuid,
  content text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  scheduled_for timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Voicemails
CREATE TABLE IF NOT EXISTS public.voicemails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  audio_url text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  transcription text,
  is_read boolean DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Blocked users
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Call notes
CREATE TABLE IF NOT EXISTS public.call_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.call_sessions(id),
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Call schedules
CREATE TABLE IF NOT EXISTS public.scheduled_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL,
  participant_ids uuid[] NOT NULL,
  title text,
  description text,
  scheduled_for timestamp with time zone NOT NULL,
  duration_minutes integer DEFAULT 30,
  call_type text NOT NULL DEFAULT 'video' CHECK (call_type IN ('video', 'audio')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  reminder_sent boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User chat settings
CREATE TABLE IF NOT EXISTS public.user_chat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  dnd_enabled boolean DEFAULT false,
  dnd_start time,
  dnd_end time,
  dnd_days integer[] DEFAULT '{}'::integer[],
  disappearing_messages_default integer,
  priority_contacts uuid[] DEFAULT '{}'::uuid[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Message read receipts for group chats
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('direct', 'group')),
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, message_type, user_id)
);

-- Communication analytics
CREATE TABLE IF NOT EXISTS public.communication_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  total_messages_sent integer DEFAULT 0,
  total_messages_received integer DEFAULT 0,
  total_calls integer DEFAULT 0,
  total_call_duration_seconds integer DEFAULT 0,
  avg_response_time_seconds integer,
  last_interaction_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, contact_id)
);

-- Enable RLS
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voicemails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "pinned_messages_select" ON public.pinned_messages FOR SELECT USING (true);
CREATE POLICY "pinned_messages_insert" ON public.pinned_messages FOR INSERT WITH CHECK (auth.uid() = pinned_by);
CREATE POLICY "pinned_messages_delete" ON public.pinned_messages FOR DELETE USING (auth.uid() = pinned_by);

CREATE POLICY "starred_messages_select" ON public.starred_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "starred_messages_insert" ON public.starred_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "starred_messages_delete" ON public.starred_messages FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "scheduled_messages_select" ON public.scheduled_messages FOR SELECT USING (auth.uid() = sender_id);
CREATE POLICY "scheduled_messages_insert" ON public.scheduled_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "scheduled_messages_update" ON public.scheduled_messages FOR UPDATE USING (auth.uid() = sender_id);
CREATE POLICY "scheduled_messages_delete" ON public.scheduled_messages FOR DELETE USING (auth.uid() = sender_id);

CREATE POLICY "voicemails_select" ON public.voicemails FOR SELECT USING (auth.uid() = recipient_id OR auth.uid() = caller_id);
CREATE POLICY "voicemails_insert" ON public.voicemails FOR INSERT WITH CHECK (auth.uid() = caller_id);
CREATE POLICY "voicemails_update" ON public.voicemails FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY "voicemails_delete" ON public.voicemails FOR DELETE USING (auth.uid() = recipient_id);

CREATE POLICY "blocked_users_select" ON public.blocked_users FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_insert" ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_delete" ON public.blocked_users FOR DELETE USING (auth.uid() = blocker_id);

CREATE POLICY "call_notes_select" ON public.call_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "call_notes_insert" ON public.call_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "call_notes_update" ON public.call_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "call_notes_delete" ON public.call_notes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "scheduled_calls_select" ON public.scheduled_calls FOR SELECT USING (auth.uid() = organizer_id OR auth.uid() = ANY(participant_ids));
CREATE POLICY "scheduled_calls_insert" ON public.scheduled_calls FOR INSERT WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "scheduled_calls_update" ON public.scheduled_calls FOR UPDATE USING (auth.uid() = organizer_id);
CREATE POLICY "scheduled_calls_delete" ON public.scheduled_calls FOR DELETE USING (auth.uid() = organizer_id);

CREATE POLICY "user_chat_settings_select" ON public.user_chat_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_chat_settings_insert" ON public.user_chat_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_chat_settings_update" ON public.user_chat_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "message_read_receipts_select" ON public.message_read_receipts FOR SELECT USING (true);
CREATE POLICY "message_read_receipts_insert" ON public.message_read_receipts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "communication_stats_select" ON public.communication_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "communication_stats_insert" ON public.communication_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "communication_stats_update" ON public.communication_stats FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.voicemails;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_calls;