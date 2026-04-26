-- Meeting copilot integration (MeetingBot service).
--
-- One row per bot scheduled / running / finished against a meeting URL.
-- The MeetingBot service does the heavy lifting (Zoom/Meet/Teams join,
-- recording, transcription, analysis); we persist the lifecycle here so
-- the user can:
--   - see what's joining, when, and why
--   - read the transcript + summary + action items after the call
--   - link a bot to an existing calendar `events` row (if scheduled
--     from there) so the meeting prep / follow-up tools can find it.
--
-- The actual bot id (from MeetingBot) lives in `external_bot_id`. Our
-- own primary key stays a UUID so foreign keys to local tasks /
-- workspaces stay portable.

CREATE TABLE IF NOT EXISTS public.meeting_bots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  -- Optional link to an existing calendar event row. Lets the calendar
  -- detail view show bot status alongside attendees.
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  -- Opaque id returned by MeetingBot's POST /api/v1/bot. NULL until
  -- the create call comes back; if creation failed we still keep the
  -- row so the user has an audit trail.
  external_bot_id TEXT,
  meeting_url TEXT NOT NULL,
  -- Human label. We pre-fill from the linked event title if available.
  title TEXT,
  bot_name TEXT NOT NULL DEFAULT 'Notetaker',
  -- Lifecycle. Mirrors MeetingBot's terminal-state taxonomy plus a
  -- local 'pending' for "row created, external call hasn't returned
  -- yet" so a crashed schedule doesn't leave an orphan.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'scheduled', 'joining', 'in_call',
      'call_ended', 'transcript_ready', 'analysis_ready',
      'done', 'error', 'cancelled'
    )),
  -- ISO-8601 timestamp the user picked for join (NULL = "join now").
  join_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  -- Bulky payload columns. JSONB so we can index later by speaker,
  -- topic, etc. without a schema change.
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  key_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  sentiment TEXT,
  -- Free-form: bot creation request, raw webhook payloads, MeetingBot's
  -- own per-platform meta. Useful for debugging without bloating the
  -- typed columns.
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  -- When auto-task creation runs, we set this so a re-delivery of the
  -- same webhook doesn't double-create tasks.
  tasks_created_at TIMESTAMPTZ,
  tasks_created_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_bot_id)
);

CREATE INDEX IF NOT EXISTS meeting_bots_user_recent_idx
  ON public.meeting_bots (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS meeting_bots_user_active_idx
  ON public.meeting_bots (user_id, updated_at DESC)
  WHERE status NOT IN ('done', 'error', 'cancelled');

CREATE INDEX IF NOT EXISTS meeting_bots_event_idx
  ON public.meeting_bots (event_id)
  WHERE event_id IS NOT NULL;

ALTER TABLE public.meeting_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own meeting bots"
  ON public.meeting_bots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own meeting bots"
  ON public.meeting_bots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own meeting bots"
  ON public.meeting_bots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own meeting bots"
  ON public.meeting_bots FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_meeting_bots_updated_at
  BEFORE UPDATE ON public.meeting_bots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
