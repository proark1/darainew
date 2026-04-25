-- Islamic event and hadith Telegram notifications
-- Stores user preferences for Islamic reminders (holidays, daily hadiths, prayer times)

CREATE TABLE IF NOT EXISTS public.islamic_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Islamic event reminders (Eid, Ramadan, etc.)
  events_enabled boolean NOT NULL DEFAULT true,
  events_hours_before integer NOT NULL DEFAULT 24, -- Notify 24 hours before
  events_send_time text DEFAULT '08:00', -- HH:MM format, user's local time

  -- Daily hadith delivery
  daily_hadith_enabled boolean NOT NULL DEFAULT true,
  daily_hadith_time text DEFAULT '07:00', -- HH:MM format, user's local time
  hadith_source_preference text DEFAULT 'mixed', -- 'mixed' | 'bukhari' | 'muslim' | 'tirmidhi' | 'abudawud'

  -- Prayer time reminders
  prayer_reminders_enabled boolean NOT NULL DEFAULT true,
  prayer_reminder_minutes_before integer NOT NULL DEFAULT 5, -- Notify 5 min before
  prayer_reminders_for_all_five boolean NOT NULL DEFAULT true,
  prayer_reminders_selected jsonb DEFAULT '["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]'::jsonb, -- Array of prayer names

  -- Language preference for notifications
  notification_language text DEFAULT 'en', -- 'en' | 'ar' | etc

  -- Timezone (important for scheduling notifications)
  timezone text DEFAULT 'UTC',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_islamic_notification_settings_user_id ON public.islamic_notification_settings(user_id);

ALTER TABLE public.islamic_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own Islamic notification settings"
  ON public.islamic_notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update their own Islamic notification settings"
  ON public.islamic_notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own Islamic notification settings"
  ON public.islamic_notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_islamic_notification_settings_updated_at
  BEFORE UPDATE ON public.islamic_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table to track which Islamic events have been notified (prevent duplicate sends)
CREATE TABLE IF NOT EXISTS public.islamic_event_notifications_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, event_name, event_date)
);

CREATE INDEX idx_islamic_event_notifications_sent_user_date ON public.islamic_event_notifications_sent(user_id, event_date);

ALTER TABLE public.islamic_event_notifications_sent ENABLE ROW LEVEL SECURITY;
-- Service role only (for cron jobs)

-- Table to track daily hadith delivery (prevent resending the same hadith)
CREATE TABLE IF NOT EXISTS public.islamic_daily_hadith_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hadith_id integer NOT NULL,
  sent_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, sent_date)
);

CREATE INDEX idx_islamic_daily_hadith_sent_user_date ON public.islamic_daily_hadith_sent(user_id, sent_date);

ALTER TABLE public.islamic_daily_hadith_sent ENABLE ROW LEVEL SECURITY;
-- Service role only (for cron jobs)
