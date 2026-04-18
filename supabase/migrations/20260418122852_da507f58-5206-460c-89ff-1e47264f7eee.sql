-- Episodic memories: people + place + time events Dori can recall
CREATE TABLE public.episodic_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  occurred_on DATE NOT NULL,
  occurred_end DATE,
  title TEXT NOT NULL,
  summary TEXT,
  location TEXT,
  location_country TEXT,
  people JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'auto',
  source_ref TEXT,
  importance INTEGER DEFAULT 3,
  embedding_vector JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_episodic_memories_user_date ON public.episodic_memories(user_id, occurred_on DESC);
CREATE INDEX idx_episodic_memories_location ON public.episodic_memories(user_id, location);

ALTER TABLE public.episodic_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own episodic memories" ON public.episodic_memories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own episodic memories" ON public.episodic_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own episodic memories" ON public.episodic_memories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own episodic memories" ON public.episodic_memories
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_episodic_memories_updated_at
  BEFORE UPDATE ON public.episodic_memories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Learned routines: recurring patterns that could become automations
CREATE TABLE public.learned_routines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  routine_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  pattern JSONB NOT NULL DEFAULT '{}'::jsonb,
  frequency TEXT,
  confidence NUMERIC DEFAULT 0.5,
  occurrences INTEGER DEFAULT 1,
  last_occurred_at TIMESTAMPTZ,
  next_expected_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'suggested',
  automation_rule_id UUID,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_learned_routines_fingerprint ON public.learned_routines(user_id, fingerprint);
CREATE INDEX idx_learned_routines_status ON public.learned_routines(user_id, status);

ALTER TABLE public.learned_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own learned routines" ON public.learned_routines
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own learned routines" ON public.learned_routines
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own learned routines" ON public.learned_routines
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own learned routines" ON public.learned_routines
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_learned_routines_updated_at
  BEFORE UPDATE ON public.learned_routines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Life Score commentary: Dori's notes on score trends
CREATE TABLE public.life_score_commentary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  observation_date DATE NOT NULL,
  current_score NUMERIC,
  previous_score NUMERIC,
  delta NUMERIC,
  trend TEXT,
  headline TEXT NOT NULL,
  commentary TEXT NOT NULL,
  contributing_factors JSONB DEFAULT '[]'::jsonb,
  suggestions JSONB DEFAULT '[]'::jsonb,
  pushed_to_telegram BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_life_score_commentary_user_date ON public.life_score_commentary(user_id, observation_date);

ALTER TABLE public.life_score_commentary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own life score commentary" ON public.life_score_commentary
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own life score commentary" ON public.life_score_commentary
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own life score commentary" ON public.life_score_commentary
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own life score commentary" ON public.life_score_commentary
  FOR DELETE USING (auth.uid() = user_id);