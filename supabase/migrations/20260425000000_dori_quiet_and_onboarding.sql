-- Proactive-quiet + onboarding-checklist settings.
--
-- Focus mode: user can silence Dori for a bounded window (/focus 2h).
-- Event suppression: default on, skip nudges while a meeting is in progress.
-- Onboarding checklist: tracked on proactive_settings so we can dismiss
-- the dashboard card without resetting the main onboarding flag.

ALTER TABLE public.proactive_settings
  ADD COLUMN IF NOT EXISTS focus_mode_until timestamptz,
  ADD COLUMN IF NOT EXISTS suppress_during_events boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_checklist_dismissed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.proactive_settings.focus_mode_until IS
  'If in the future, Dori suppresses every proactive channel until this instant. Set via /focus.';
COMMENT ON COLUMN public.proactive_settings.suppress_during_events IS
  'When true, skip proactive notifications while a calendar event is in progress.';
COMMENT ON COLUMN public.proactive_settings.onboarding_checklist_dismissed IS
  'True once the dashboard Getting Started checklist has been closed for good.';

CREATE INDEX IF NOT EXISTS proactive_settings_focus_mode_idx
  ON public.proactive_settings (user_id)
  WHERE focus_mode_until IS NOT NULL;
