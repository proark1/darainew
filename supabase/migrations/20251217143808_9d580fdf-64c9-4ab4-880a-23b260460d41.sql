-- Create shared_project_members table for project collaboration
CREATE TABLE public.shared_project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- The user who has access
  owner_id UUID NOT NULL, -- The project owner who shared it
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.shared_project_members ENABLE ROW LEVEL SECURITY;

-- Policies for shared_project_members
CREATE POLICY "Users can view projects shared with them"
ON public.shared_project_members
FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = owner_id);

CREATE POLICY "Project owners can share their projects"
ON public.shared_project_members
FOR INSERT
WITH CHECK (
  auth.uid() = owner_id AND
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
);

CREATE POLICY "Project owners can remove shares"
ON public.shared_project_members
FOR DELETE
USING (auth.uid() = owner_id);

-- Update projects RLS to allow viewing shared projects
CREATE POLICY "Users can view shared projects"
ON public.projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shared_project_members 
    WHERE project_id = projects.id AND user_id = auth.uid()
  )
);

-- Allow shared members to view tasks in shared projects
CREATE POLICY "Users can view tasks in shared projects"
ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shared_project_members spm
    JOIN public.projects p ON p.id = spm.project_id
    WHERE p.id = tasks.project_id AND spm.user_id = auth.uid()
  )
);

-- Allow shared members to add tasks to shared projects
CREATE POLICY "Users can add tasks to shared projects"
ON public.tasks
FOR INSERT
WITH CHECK (
  project_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.shared_project_members spm
    WHERE spm.project_id = tasks.project_id AND spm.user_id = auth.uid()
  )
);

-- Allow shared members to update tasks in shared projects
CREATE POLICY "Users can update tasks in shared projects"
ON public.tasks
FOR UPDATE
USING (
  project_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.shared_project_members spm
    WHERE spm.project_id = tasks.project_id AND spm.user_id = auth.uid()
  )
);

-- Enable realtime for shared_project_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_project_members;