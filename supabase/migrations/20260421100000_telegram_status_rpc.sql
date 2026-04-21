-- DB-level diagnostic for Settings → Telegram → Diagnose. We use an RPC
-- (deployed via migration) because edge-function deploys have been lagging
-- behind frontend deploys, and this path is always up-to-date with main.
--
-- Returns:
--   bot_state.{update_offset, updated_at, last_tick_seconds}
--     — proves whether the poll-telegram-updates cron is actually running
--   cron_job_exists
--     — true if the cron.job row is present (migration 20260421090000 ran)
--   link.{is_active, chat_id, telegram_username, linked_at}
--     — current user's personal telegram_links row (or null)
--   group_link.{is_active, chat_id, title, linked_at}
--     — current user's telegram_group_links row (or null)

CREATE OR REPLACE FUNCTION public.telegram_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_bot_state record;
  v_last_tick_seconds integer;
  v_link jsonb;
  v_group jsonb;
  v_cron_exists boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT update_offset, updated_at INTO v_bot_state
  FROM public.telegram_bot_state WHERE id = 1;

  IF v_bot_state.updated_at IS NOT NULL THEN
    v_last_tick_seconds := EXTRACT(EPOCH FROM (now() - v_bot_state.updated_at))::integer;
  END IF;

  BEGIN
    SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'poll-telegram-updates')
    INTO v_cron_exists;
  EXCEPTION WHEN OTHERS THEN
    v_cron_exists := NULL;
  END;

  SELECT to_jsonb(l) INTO v_link
  FROM (
    SELECT is_active, chat_id, telegram_username, telegram_first_name, linked_at
    FROM public.telegram_links WHERE user_id = v_user_id
  ) l;

  SELECT to_jsonb(g) INTO v_group
  FROM (
    SELECT is_active, chat_id, title, linked_at
    FROM public.telegram_group_links WHERE owner_user_id = v_user_id
  ) g;

  RETURN jsonb_build_object(
    'bot_state', jsonb_build_object(
      'update_offset', v_bot_state.update_offset,
      'updated_at', v_bot_state.updated_at,
      'last_tick_seconds', v_last_tick_seconds
    ),
    'cron_job_exists', v_cron_exists,
    'link', v_link,
    'group_link', v_group,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.telegram_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.telegram_status() TO authenticated;
