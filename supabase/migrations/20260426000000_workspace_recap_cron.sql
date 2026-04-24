-- Friday-evening workspace-recap cron.
--
-- pg_cron pings workspace-recap-cron every hour. The function decides
-- which workspaces are currently inside their owner's Friday-17:00
-- window (per-owner timezone) and dispatches the recap to the linked
-- Telegram group via workspace-weekly-recap. Per-ISO-week dedupe lives
-- in the function (dori_proactive_log) so this cron can run more often
-- without duplicate posts.
--
-- Auth: the function gates on Authorization: Bearer <service_role>.
-- We source the bearer from Vault so the secret never lives inline in
-- migration source. The operator must add it once:
--   INSERT INTO vault.secrets (name, secret) VALUES ('service_role_key', '<key>');
-- If the secret is missing the cron sends "Bearer " and the function
-- replies 401 — visible failure rather than a silent wrong-secret.
--
-- Note on the hardcoded URL: this matches the existing telegram-poll
-- cron (20260421090000). A cross-cutting fix that reads the project URL
-- from Vault should change both crons together; out of scope for this PR.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'workspace-recap-cron') THEN
    PERFORM cron.unschedule('workspace-recap-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'workspace-recap-cron',
  '5 * * * *',  -- 5 minutes past every hour
  $$
  SELECT net.http_post(
    url := 'https://femilfmcmqmdbncmgcxh.supabase.co/functions/v1/workspace-recap-cron',
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
