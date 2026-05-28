-- Custom Daily Briefings.
--
-- Users define any number of briefings in the UI, each with its own topics,
-- delivery time (local), active weekdays, and delivery channels. A pg_cron
-- job pings the `briefing-dispatch-cron` edge function every 15 minutes; the
-- function resolves each user's local time and sends the matching briefings.
--
--   1. public.briefings            — per-briefing configuration (RLS by owner)
--   2. public.briefing_deliveries  — delivery history / archive (RLS by owner)
--   3. briefing-dispatch-cron      — every 15 minutes

-- ============================================================
-- 1. briefings — user-defined briefing configurations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.briefings (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL,
  name          TEXT NOT NULL DEFAULT 'My Briefing',
  enabled       BOOLEAN NOT NULL DEFAULT true,
  topics        TEXT[] NOT NULL DEFAULT '{}',
  deliver_at    TIME NOT NULL DEFAULT '08:00',
  days_of_week  INT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',  -- 0=Sunday .. 6=Saturday
  channels      TEXT[] NOT NULL DEFAULT '{telegram,push}',
  max_items     INT NOT NULL DEFAULT 5,
  last_sent_on  DATE,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS briefings_user_id_idx ON public.briefings (user_id);
CREATE INDEX IF NOT EXISTS briefings_enabled_idx ON public.briefings (enabled) WHERE enabled;

ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own briefings"
  ON public.briefings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own briefings"
  ON public.briefings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own briefings"
  ON public.briefings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own briefings"
  ON public.briefings FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. briefing_deliveries — delivery history / archive
-- ============================================================
CREATE TABLE IF NOT EXISTS public.briefing_deliveries (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_id   UUID REFERENCES public.briefings(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL,
  generated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  content       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of news items
  channels_sent TEXT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'sent'
);

CREATE INDEX IF NOT EXISTS briefing_deliveries_user_id_idx
  ON public.briefing_deliveries (user_id, generated_at DESC);

ALTER TABLE public.briefing_deliveries ENABLE ROW LEVEL SECURITY;

-- Read-only for owners; rows are written by the service role from the cron.
CREATE POLICY "Users can view their own briefing deliveries"
  ON public.briefing_deliveries FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. briefing-dispatch-cron — every 15 minutes
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'briefing-dispatch-cron') THEN
    PERFORM cron.unschedule('briefing-dispatch-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'briefing-dispatch-cron',
  '*/15 * * * *',  -- every 15 minutes; the function checks each user's local time
  $$
  SELECT net.http_post(
    url := 'https://femilfmcmqmdbncmgcxh.supabase.co/functions/v1/briefing-dispatch-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

NOTIFY pgrst, 'reload schema';
