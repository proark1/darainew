-- Add public key storage to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS public_key text;

-- Add encryption columns to direct_messages
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS encrypted_content text,
ADD COLUMN IF NOT EXISTS encryption_version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS encrypted_key text;

-- Add encryption columns to group_messages
ALTER TABLE public.group_messages 
ADD COLUMN IF NOT EXISTS encrypted_content text,
ADD COLUMN IF NOT EXISTS encryption_version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS encrypted_keys jsonb DEFAULT '{}'::jsonb;

-- Create table for group encryption keys
CREATE TABLE IF NOT EXISTS public.group_encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  encrypted_group_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS on group_encryption_keys
ALTER TABLE public.group_encryption_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_encryption_keys
CREATE POLICY "Users can view their own group keys"
ON public.group_encryption_keys FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own group keys"
ON public.group_encryption_keys FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own group keys"
ON public.group_encryption_keys FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own group keys"
ON public.group_encryption_keys FOR DELETE
USING (auth.uid() = user_id);