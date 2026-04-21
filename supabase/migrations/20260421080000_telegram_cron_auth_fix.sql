-- Reschedule the poll-telegram-updates cron to authenticate with a shared
-- internal secret instead of the public anon key. Previously the cron passed
-- the anon JWT (see migration 20260417012716) but the telegram-poll function
-- only accepted the service-role key, so every tick returned 401 and no
-- Telegram messages were processed.
--
-- Prerequisite (one-time operator step, performed OUTSIDE this migration to
-- keep the secret out of git):
--
--   SELECT vault.create_secret('<random-long-string>', 'telegram_cron_secret');
--
-- The same value must be set as the TELEGRAM_CRON_SECRET environment variable
-- on the telegram-poll edge function so the in-function auth check matches.

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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'telegram_cron_secret'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
