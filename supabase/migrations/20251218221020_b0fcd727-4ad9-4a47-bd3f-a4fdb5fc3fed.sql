-- Add status column to tasks for Kanban board support
ALTER TABLE public.tasks 
ADD COLUMN status text NOT NULL DEFAULT 'backlog';

-- Add a check constraint to ensure valid status values
ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_status_check CHECK (status IN ('backlog', 'in_progress', 'done'));

-- Create an index on status for better query performance
CREATE INDEX idx_tasks_status ON public.tasks (status);