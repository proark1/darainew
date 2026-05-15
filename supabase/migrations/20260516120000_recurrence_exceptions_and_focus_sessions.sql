-- Round-2 audit follow-ups.
--
-- 1) recurrence_exceptions: lets a user skip individual occurrences of a
--    recurring task/event without rewriting the RRULE. The chat function
--    expands occurrences by reading recurrence_rule (FREQ/BYDAY/UNTIL) and
--    filtering out any (parent_id, exception_date) pair in this table.
--    Backed by a manage_exception tool that the AI emits for phrases like
--    "skip next Tuesday" or "cancel this Wednesday's class".
--
-- 2) focus_sessions: time-tracking. A row per focus block; the manage_focus
--    tool starts/stops sessions and aggregates "how much time on X this
--    week". An open session has ended_at NULL — only one open session per
--    user at a time (enforced via a partial unique index, not a check
--    constraint, because PostgreSQL CHECK can't reference COUNT()).

CREATE TABLE IF NOT EXISTS public.recurrence_exceptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  -- 'task' or 'event'. We don't FK to either table because the parent row
  -- can disappear (delete) without dragging exceptions along; the foreign
  -- side is cleaned up by a periodic sweeper.
  parent_kind text NOT NULL CHECK (parent_kind IN ('task', 'event')),
  parent_id uuid NOT NULL,
  -- The local-date of the skipped occurrence (YYYY-MM-DD in the user's tz).
  -- Stored as date so a single value covers both task-due-on-day and
  -- event-starting-on-day. Multi-day events still match on their start day.
  exception_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_kind, parent_id, exception_date)
);

CREATE INDEX IF NOT EXISTS recurrence_exceptions_user_idx
  ON public.recurrence_exceptions (user_id, parent_kind, parent_id);

ALTER TABLE public.recurrence_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own exceptions"
  ON public.recurrence_exceptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  -- Free-text label for sessions not tied to a specific task ("deep work
  -- on Q3 plan"). NULL when task_id is set, since the task title covers
  -- it; either label or task_id must be present (enforced in the tool
  -- handler so we don't reject historic backfills).
  label text,
  category text NOT NULL DEFAULT 'personal'
    CHECK (category IN ('business', 'personal', 'family', 'shared', 'focus')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_minutes integer GENERATED ALWAYS AS (
    CASE
      WHEN ended_at IS NULL THEN NULL
      ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60)::integer)
    END
  ) STORED,
  workspace_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- At most one open (ended_at IS NULL) session per user. Partial unique
-- index is the postgres-idiomatic way to express "only one row matching
-- this predicate may exist per user".
CREATE UNIQUE INDEX IF NOT EXISTS focus_sessions_one_open_per_user
  ON public.focus_sessions (user_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS focus_sessions_user_time_idx
  ON public.focus_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS focus_sessions_task_idx
  ON public.focus_sessions (task_id) WHERE task_id IS NOT NULL;

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own focus sessions"
  ON public.focus_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) telegram_documents: a per-user cache of the latest document the user
--    uploaded via Telegram. The summarise_document tool pulls extracted_text
--    from here rather than re-downloading on every turn (Telegram file_ids
--    are also short-lived). One row replaces the previous on each upload —
--    we don't keep history, since the user only ever refers to "the doc I
--    just sent".

CREATE TABLE IF NOT EXISTS public.telegram_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer,
  -- Plain-text extraction. For PDFs this is the page text; for text/* it's
  -- the body as-is. Hard-capped server-side before insert.
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own documents"
  ON public.telegram_documents FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role writes documents"
  ON public.telegram_documents FOR ALL
  USING (true) WITH CHECK (true);

-- PostgREST cache pickup.
NOTIFY pgrst, 'reload schema';
