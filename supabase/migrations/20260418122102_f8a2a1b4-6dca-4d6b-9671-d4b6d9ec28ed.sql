
-- Email classifications
CREATE TABLE public.email_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email_id UUID NOT NULL,
  category TEXT NOT NULL, -- bill, meeting_request, family_logistics, newsletter, personal, work, other
  suggested_action TEXT, -- create_contract, create_event, create_task, none
  suggested_payload JSONB DEFAULT '{}'::jsonb,
  confidence NUMERIC DEFAULT 0.5,
  reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, applied, dismissed
  applied_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email_id)
);
CREATE INDEX idx_email_class_user ON public.email_classifications(user_id, status, created_at DESC);
ALTER TABLE public.email_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_email_class_select" ON public.email_classifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_email_class_insert" ON public.email_classifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_email_class_update" ON public.email_classifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_email_class_delete" ON public.email_classifications FOR DELETE USING (auth.uid() = user_id);

-- Proactive feedback (thumbs up/down on Dori's proactive messages)
CREATE TABLE public.proactive_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_key TEXT,
  channel TEXT NOT NULL DEFAULT 'telegram', -- telegram, web, push
  rating SMALLINT NOT NULL, -- 1 = helpful, -1 = not helpful
  message_excerpt TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pf_user_trigger ON public.proactive_feedback(user_id, trigger_type, created_at DESC);
ALTER TABLE public.proactive_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_pf_select" ON public.proactive_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_pf_insert" ON public.proactive_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_pf_update" ON public.proactive_feedback FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_pf_delete" ON public.proactive_feedback FOR DELETE USING (auth.uid() = user_id);

-- Detected conflicts
CREATE TABLE public.detected_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conflict_type TEXT NOT NULL, -- overlap, tight_transition, double_booking, missed_pickup
  severity TEXT NOT NULL DEFAULT 'medium', -- low, medium, high
  title TEXT NOT NULL,
  description TEXT,
  entities JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{type:'event', id, title, start, end}]
  suggested_resolution TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open, acknowledged, resolved, dismissed
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  fingerprint TEXT NOT NULL, -- for deduplication
  UNIQUE(user_id, fingerprint)
);
CREATE INDEX idx_dc_user_status ON public.detected_conflicts(user_id, status, detected_at DESC);
ALTER TABLE public.detected_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_dc_select" ON public.detected_conflicts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_dc_insert" ON public.detected_conflicts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_dc_update" ON public.detected_conflicts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_dc_delete" ON public.detected_conflicts FOR DELETE USING (auth.uid() = user_id);
