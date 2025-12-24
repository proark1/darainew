-- Daily check-ins table for mood, energy, sleep tracking
CREATE TABLE public.daily_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  checkin_type TEXT NOT NULL DEFAULT 'morning', -- 'morning' or 'evening'
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Morning check-in fields
  sleep_hours NUMERIC,
  sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
  energy_level TEXT CHECK (energy_level IN ('low', 'medium', 'high')),
  mood TEXT, -- emoji or text
  physical_symptoms TEXT[],
  main_focus TEXT, -- intention for the day
  
  -- Evening reflection fields
  day_rating INTEGER CHECK (day_rating >= 1 AND day_rating <= 5),
  focus_completed BOOLEAN,
  went_well TEXT,
  challenges TEXT,
  tomorrow_priority TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, checkin_date, checkin_type)
);

-- Enable RLS
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own checkins" ON public.daily_checkins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own checkins" ON public.daily_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checkins" ON public.daily_checkins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own checkins" ON public.daily_checkins
  FOR DELETE USING (auth.uid() = user_id);

-- Gamification: User XP and achievements
CREATE TABLE public.user_xp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  
  -- Streak tracking
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  
  -- Badge tracking (JSON array of earned badges)
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Weekly stats
  weekly_xp INTEGER NOT NULL DEFAULT 0,
  weekly_tasks_completed INTEGER NOT NULL DEFAULT 0,
  weekly_focus_minutes INTEGER NOT NULL DEFAULT 0,
  weekly_habits_logged INTEGER NOT NULL DEFAULT 0,
  week_start_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own xp" ON public.user_xp
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own xp" ON public.user_xp
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own xp" ON public.user_xp
  FOR UPDATE USING (auth.uid() = user_id);

-- AI Insights table for weekly analysis
CREATE TABLE public.ai_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  insight_type TEXT NOT NULL DEFAULT 'weekly', -- 'weekly', 'pattern', 'suggestion'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb, -- supporting data/correlations
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_actionable BOOLEAN NOT NULL DEFAULT false,
  action_taken BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own insights" ON public.ai_insights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own insights" ON public.ai_insights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights" ON public.ai_insights
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights" ON public.ai_insights
  FOR DELETE USING (auth.uid() = user_id);

-- Smart Nudge Rules
CREATE TABLE public.nudge_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Trigger conditions (JSONB for flexibility)
  trigger_type TEXT NOT NULL, -- 'time', 'inactivity', 'task_overdue', 'mood_based', 'custom'
  trigger_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Action to take
  action_type TEXT NOT NULL, -- 'notification', 'auto_reschedule', 'suggest_break', 'reduce_load'
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Settings
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 5, -- 1-10, higher = more important
  
  -- Stats
  times_triggered INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nudge_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own nudge rules" ON public.nudge_rules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own nudge rules" ON public.nudge_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nudge rules" ON public.nudge_rules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own nudge rules" ON public.nudge_rules
  FOR DELETE USING (auth.uid() = user_id);

-- Brain dump / quick capture inbox
CREATE TABLE public.brain_dumps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  voice_url TEXT, -- if captured via voice
  
  -- Processing status
  is_processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- AI categorization
  suggested_type TEXT, -- 'task', 'event', 'note', 'reminder'
  suggested_category TEXT,
  suggested_priority TEXT,
  ai_summary TEXT,
  
  -- If converted to item
  converted_to_type TEXT,
  converted_to_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brain_dumps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own brain dumps" ON public.brain_dumps
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own brain dumps" ON public.brain_dumps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brain dumps" ON public.brain_dumps
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own brain dumps" ON public.brain_dumps
  FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_daily_checkins_updated_at
  BEFORE UPDATE ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_xp_updated_at
  BEFORE UPDATE ON public.user_xp
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nudge_rules_updated_at
  BEFORE UPDATE ON public.nudge_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();