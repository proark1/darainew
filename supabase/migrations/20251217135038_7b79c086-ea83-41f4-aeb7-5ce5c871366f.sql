-- Add responsible fields to tasks
ALTER TABLE public.tasks 
ADD COLUMN main_responsible_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN secondary_responsible_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create projects table
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#3b82f6',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Projects RLS policies
CREATE POLICY "Users can view own projects" ON public.projects
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects" ON public.projects
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.projects
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON public.projects
FOR DELETE USING (auth.uid() = user_id);

-- Add project_id to tasks
ALTER TABLE public.tasks 
ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create weekly_reviews table
CREATE TABLE public.weekly_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  completed_tasks_count integer DEFAULT 0,
  incomplete_tasks_reviewed text[], -- task IDs that were reviewed
  intentions text, -- markdown content for intentions
  celebrations text, -- markdown content for wins
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Enable RLS on weekly_reviews
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

-- Weekly reviews RLS policies
CREATE POLICY "Users can view own reviews" ON public.weekly_reviews
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reviews" ON public.weekly_reviews
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews" ON public.weekly_reviews
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews" ON public.weekly_reviews
FOR DELETE USING (auth.uid() = user_id);

-- Add rich content fields to tasks
ALTER TABLE public.tasks
ADD COLUMN checklist jsonb DEFAULT '[]',
ADD COLUMN attachments jsonb DEFAULT '[]',
ADD COLUMN comments jsonb DEFAULT '[]';

-- Create trigger for projects updated_at
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for weekly_reviews updated_at
CREATE TRIGGER update_weekly_reviews_updated_at
BEFORE UPDATE ON public.weekly_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();