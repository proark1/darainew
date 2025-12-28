-- Create dedicated call-recordings bucket with proper RLS
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for call-recordings bucket
CREATE POLICY "Users can upload their own call recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'call-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own call recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'call-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own call recordings"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'call-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add sharing_confirmed column to space_share_settings for explicit consent
ALTER TABLE public.space_share_settings 
ADD COLUMN IF NOT EXISTS sharing_confirmed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS consent_message text;