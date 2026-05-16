-- Weekly Monday-morning Telegram briefing of upcoming calendar entries.
--
-- 1. Extend telegram_links with opt-out + send-bookkeeping columns.
-- 2. Schedule a pg_cron job that pings the telegram-weekly-briefing edge
--    function every hour. The function itself decides whether the user's
--    local time is Monday 08:xx before sending.

ALTER TABLE public.telegram_links
  ADD COLUMN IF NOT EXISTS weekly_briefing_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_briefing_last_sent_on date;

COMMENT ON COLUMN public.telegram_links.weekly_briefing_enabled IS
  'When true, user receives a Monday 08:00 (local time) Telegram briefing of the next 7 days of calendar entries.';
COMMENT ON COLUMN public.telegram_links.weekly_briefing_last_sent_on IS
  'Local-date stamp of the last weekly briefing send, used to dedupe within the cron evaluation window.';

-- Hourly cron — the edge function evaluates each user's local weekday/hour.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-weekly-briefing-cron') THEN
    PERFORM cron.unschedule('telegram-weekly-briefing-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'telegram-weekly-briefing-cron',
  '0 * * * *',  -- top of every hour
  $$
  SELECT net.http_post(
    url := 'https://femilfmcmqmdbncmgcxh.supabase.co/functions/v1/telegram-weekly-briefing',
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
