-- Create location_triggers table for geofencing reminders
CREATE TABLE public.location_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('enter', 'exit', 'both')),
  reminder_message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.location_triggers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own location triggers"
ON public.location_triggers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own location triggers"
ON public.location_triggers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own location triggers"
ON public.location_triggers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own location triggers"
ON public.location_triggers FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_location_triggers_updated_at
BEFORE UPDATE ON public.location_triggers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for quick lookups
CREATE INDEX idx_location_triggers_user_active ON public.location_triggers(user_id, is_active);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_triggers;

-- Add calendar_overload_enabled to proactive_settings
ALTER TABLE public.proactive_settings 
ADD COLUMN IF NOT EXISTS calendar_overload_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS calendar_overload_threshold INTEGER DEFAULT 6;