
CREATE TABLE public.detected_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  destination TEXT NOT NULL,
  destination_country TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'calendar',
  source_ref TEXT,
  contacts_in_destination JSONB DEFAULT '[]'::jsonb,
  packing_reminder_sent BOOLEAN DEFAULT false,
  travel_blocks_added BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'upcoming',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fingerprint TEXT NOT NULL,
  UNIQUE(user_id, fingerprint)
);
CREATE INDEX idx_dt_user_dates ON public.detected_trips(user_id, start_date);
ALTER TABLE public.detected_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_dt_select" ON public.detected_trips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_dt_insert" ON public.detected_trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_dt_update" ON public.detected_trips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_dt_delete" ON public.detected_trips FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.meeting_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_id UUID NOT NULL,
  brief_text TEXT NOT NULL,
  attendees JSONB DEFAULT '[]'::jsonb,
  related_contacts JSONB DEFAULT '[]'::jsonb,
  related_emails JSONB DEFAULT '[]'::jsonb,
  related_contracts JSONB DEFAULT '[]'::jsonb,
  delivered_at TIMESTAMPTZ,
  delivered_channel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);
CREATE INDEX idx_mb_user ON public.meeting_briefs(user_id, created_at DESC);
ALTER TABLE public.meeting_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_mb_select" ON public.meeting_briefs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_mb_insert" ON public.meeting_briefs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_mb_update" ON public.meeting_briefs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_mb_delete" ON public.meeting_briefs FOR DELETE USING (auth.uid() = user_id);
