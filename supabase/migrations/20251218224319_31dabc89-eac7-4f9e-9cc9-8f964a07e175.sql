-- Add read_at and reactions to direct_messages
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;

-- Create chat groups table
CREATE TABLE public.chat_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat group members table
CREATE TABLE public.chat_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group messages table
CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  attachments JSONB DEFAULT '[]'::jsonb,
  reactions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create message read status for groups
CREATE TABLE public.group_message_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_message_reads ENABLE ROW LEVEL SECURITY;

-- Chat groups policies
CREATE POLICY "Users can view groups they belong to"
ON public.chat_groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members 
    WHERE group_id = chat_groups.id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create groups"
ON public.chat_groups FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update groups"
ON public.chat_groups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members 
    WHERE group_id = chat_groups.id AND user_id = auth.uid() AND role = 'admin'
  )
);

-- Group members policies
CREATE POLICY "Users can view group members"
ON public.chat_group_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members m
    WHERE m.group_id = chat_group_members.group_id AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Group admins can add members"
ON public.chat_group_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_group_members m
    WHERE m.group_id = chat_group_members.group_id AND m.user_id = auth.uid() AND m.role = 'admin'
  ) OR
  EXISTS (
    SELECT 1 FROM public.chat_groups g
    WHERE g.id = chat_group_members.group_id AND g.created_by = auth.uid()
  )
);

CREATE POLICY "Group admins can remove members"
ON public.chat_group_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members m
    WHERE m.group_id = chat_group_members.group_id AND m.user_id = auth.uid() AND m.role = 'admin'
  ) OR user_id = auth.uid()
);

-- Group messages policies
CREATE POLICY "Group members can view messages"
ON public.group_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members 
    WHERE group_id = group_messages.group_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Group members can send messages"
ON public.group_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.chat_group_members 
    WHERE group_id = group_messages.group_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Senders can update their messages"
ON public.group_messages FOR UPDATE
USING (auth.uid() = sender_id);

-- Group message reads policies
CREATE POLICY "Users can mark messages as read"
ON public.group_message_reads FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Group members can view read status"
ON public.group_message_reads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_messages gm
    JOIN public.chat_group_members cgm ON cgm.group_id = gm.group_id
    WHERE gm.id = group_message_reads.message_id AND cgm.user_id = auth.uid()
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_message_reads;

-- Update direct messages update policy for reactions
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON public.direct_messages;
CREATE POLICY "Users can update messages they're part of"
ON public.direct_messages FOR UPDATE
USING ((auth.uid() = sender_id) OR (auth.uid() = recipient_id));