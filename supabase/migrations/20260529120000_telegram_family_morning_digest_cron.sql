-- Schedule the daily family morning digest.
--
-- The `telegram-family-morning-digest` edge function (and its config.toml
-- verify_jwt=false entry) already existed, but no pg_cron job ever invoked it,
-- so linked family groups never received their morning digest. This migration
-- registers the missing hourly cron.
--
-- Like the weekly briefing, the function is timezone-aware: it runs hourly and
-- only sends to a group when the owner's local hour matches the group's
-- `morning_digest_hour`, deduping on `morning_digest_last_sent_on`. The cron
-- therefore just needs to ping it every hour.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-family-morning-digest-cron') THEN
    PERFORM cron.unschedule('telegram-family-morning-digest-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'telegram-family-morning-digest-cron',
  '0 * * * *',  -- top of every hour; the function evaluates each group's local hour
  $$
  SELECT net.http_post(
    url := 'https://femilfmcmqmdbncmgcxh.supabase.co/functions/v1/telegram-family-morning-digest',
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
