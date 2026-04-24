-- Chunk B of the second top-10 arc: team-collaboration polish.
--
-- 1) telegram_links gets an active_workspace_id so a user in a 1:1 chat
--    can /workspace <name> to scope the next N commands. No fk — the
--    id may point to a workspace the user has since left; the poll
--    handler re-verifies membership on each use.
-- 2) task_comments: threaded discussion on tasks. workspace_id is
--    denormalized from the parent task via trigger so the realtime
--    hook can filter server-side and RLS doesn't have to join.
-- 3) REPLICA IDENTITY FULL on the workspace-realtime tables so DELETE
--    payloads actually contain user_id / workspace_id (default replica
--    identity returns only primary-key fields on delete, which would
--    defeat the "skip self" check in the realtime hook).

ALTER TABLE public.telegram_links
  ADD COLUMN IF NOT EXISTS active_workspace_id uuid;

COMMENT ON COLUMN public.telegram_links.active_workspace_id IS
  'Private-chat scope: when set, subsequent AI tool calls from this Telegram user go into this workspace. /workspace off to clear.';

CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  -- Nullable because ON DELETE SET NULL needs it. We prefer keeping
  -- the comment (as "deleted user") over losing the audit trail.
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Denormalized from the parent task so RLS + realtime filters don't
  -- need a join. Populated via trigger on INSERT (and re-populated on
  -- task workspace moves, which are rare).
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  body text NOT NULL,
  source text NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_comments_body_nonempty CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS task_comments_task_created_idx
  ON public.task_comments (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_comments_workspace_idx
  ON public.task_comments (workspace_id) WHERE workspace_id IS NOT NULL;

-- Auto-fill workspace_id from the parent task on insert.
CREATE OR REPLACE FUNCTION public.task_comments_fill_workspace()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.tasks WHERE id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_comments_fill_workspace_trg ON public.task_comments;
CREATE TRIGGER task_comments_fill_workspace_trg
  BEFORE INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.task_comments_fill_workspace();

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Access follows the comment's own workspace_id when set, otherwise
-- the author (for personal-task comments). RLS no longer has to join
-- back to the tasks table on every read.
CREATE POLICY "Read task comments"
  ON public.task_comments FOR SELECT
  USING (
    (workspace_id IS NULL AND author_id = auth.uid())
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  );

CREATE POLICY "Write task comments"
  ON public.task_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND (
      workspace_id IS NULL OR public.is_workspace_member(workspace_id)
    )
  );

CREATE POLICY "Author deletes own task comment"
  ON public.task_comments FOR DELETE
  USING (author_id = auth.uid());

CREATE POLICY "Service role manages task comments"
  ON public.task_comments FOR ALL USING (true) WITH CHECK (true);

-- REPLICA IDENTITY FULL: emits full OLD rows on UPDATE/DELETE so the
-- realtime subscriber can read user_id / workspace_id / assignee_id
-- even on deletions. Without this the default (primary key only)
-- would make the "skip events I caused" check in
-- useWorkspaceRealtime misfire for deletes.
ALTER TABLE public.tasks          REPLICA IDENTITY FULL;
ALTER TABLE public.events         REPLICA IDENTITY FULL;
ALTER TABLE public.notes          REPLICA IDENTITY FULL;
ALTER TABLE public.task_comments  REPLICA IDENTITY FULL;
