-- Reschedule poll-telegram-updates to invoke telegram-poll with no Authorization
-- header. The function no longer has an in-function auth gate (matches the
-- email-autopilot pattern), so the cron no longer needs to carry a secret
-- and can't silently break when operator setup drifts.
--
-- Previously: the cron first shipped with a hardcoded anon JWT, then a Vault
-- lookup on 'telegram_cron_secret' that required a one-time operator step.
-- Both modes caused silent 401s when misaligned with the function. This
-- version has no auth dependency.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'poll-telegram-updates') THEN
    PERFORM cron.unschedule('poll-telegram-updates');
  END IF;
END $$;

SELECT cron.schedule(
  'poll-telegram-updates',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://femilfmcmqmdbncmgcxh.supabase.co/functions/v1/telegram-poll',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
