SELECT cron.schedule(
  'poll-telegram-updates',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://femilfmcmqmdbncmgcxh.supabase.co/functions/v1/telegram-poll',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlbWlsZm1jbXFtZGJuY21nY3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3Njk3MDAsImV4cCI6MjA4MTM0NTcwMH0.VEWyXknkEr7lcZzkVDNkjJhvM2Q3b-1PQPgdYFTjyUA"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);