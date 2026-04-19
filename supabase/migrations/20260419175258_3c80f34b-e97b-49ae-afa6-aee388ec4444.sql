
-- 1. Lock down service-only tables (RLS enabled, no end-user policies)
DROP POLICY IF EXISTS "service_only_telegram_bot_state" ON public.telegram_bot_state;
CREATE POLICY "service_only_telegram_bot_state" ON public.telegram_bot_state
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_only_telegram_messages" ON public.telegram_messages;
CREATE POLICY "service_only_telegram_messages" ON public.telegram_messages
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 2. Replace permissive INSERT policies (anyone-authenticated could insert) with self-only
DROP POLICY IF EXISTS "System can insert notifications for any user" ON public.user_notifications;
CREATE POLICY "Users can insert own notifications" ON public.user_notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert ai usage" ON public.ai_usage;
CREATE POLICY "Users can insert own ai usage" ON public.ai_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System inserts meeting reminders" ON public.meeting_reminders_sent;
CREATE POLICY "Users can insert own meeting reminders" ON public.meeting_reminders_sent
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- (Service role bypasses RLS, so backend edge functions remain unaffected.)

-- 3. Performance indexes for hot query paths
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON public.tasks(user_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON public.tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_events_user_start ON public.events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read ON public.user_notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_user_renewal ON public.contracts(user_id, renewal_date) WHERE renewal_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_contacts_user ON public.user_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created ON public.analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON public.chat_messages(user_id, created_at DESC);
