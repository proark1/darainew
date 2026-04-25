-- User location and local settings
-- Stores user's home location for prayer times and weather

CREATE TABLE IF NOT EXISTS public.user_location_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Location information
  city text NOT NULL DEFAULT 'Berlin',
  country text NOT NULL DEFAULT 'Germany',
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  timezone text NOT NULL DEFAULT 'Europe/Berlin',

  -- Weather preferences
  show_weather boolean NOT NULL DEFAULT true,
  temperature_unit text NOT NULL DEFAULT 'celsius', -- 'celsius' | 'fahrenheit'

  -- Prayer calculation method
  prayer_calculation_method integer NOT NULL DEFAULT 2, -- 2 = ISNA (can be changed by user)

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_location_settings_user_id ON public.user_location_settings(user_id);

ALTER TABLE public.user_location_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own location settings"
  ON public.user_location_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update their own location settings"
  ON public.user_location_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own location settings"
  ON public.user_location_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_location_settings_updated_at
  BEFORE UPDATE ON public.user_location_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
