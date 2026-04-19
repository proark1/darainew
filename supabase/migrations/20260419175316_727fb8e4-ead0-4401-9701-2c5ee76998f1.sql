
DROP POLICY IF EXISTS "Service role can manage all reminders" ON public.proactive_reminders;
CREATE POLICY "service_role_only_proactive_reminders" ON public.proactive_reminders
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role can manage delivery logs" ON public.reminder_delivery_log;
CREATE POLICY "service_role_only_reminder_delivery_log" ON public.reminder_delivery_log
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
