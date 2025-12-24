-- Create public holidays table (reference data, accessible to all authenticated users)
CREATE TABLE public.public_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  local_name TEXT,
  date DATE NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  is_fixed BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

-- Everyone can view public holidays (read-only reference data)
CREATE POLICY "Anyone can view public holidays"
ON public.public_holidays
FOR SELECT
USING (true);

-- Only service role can modify (managed data)
CREATE POLICY "Service role can manage public holidays"
ON public.public_holidays
FOR ALL
USING (auth.role() = 'service_role');

-- Insert German Public Holidays 2026
INSERT INTO public.public_holidays (name, local_name, date, country_code, country_name, is_fixed) VALUES
('New Year''s Day', 'Neujahr', '2026-01-01', 'DE', 'Germany', true),
('Good Friday', 'Karfreitag', '2026-04-03', 'DE', 'Germany', false),
('Easter Monday', 'Ostermontag', '2026-04-06', 'DE', 'Germany', false),
('Labour Day', 'Tag der Arbeit', '2026-05-01', 'DE', 'Germany', true),
('Ascension Day', 'Christi Himmelfahrt', '2026-05-14', 'DE', 'Germany', false),
('Whit Monday', 'Pfingstmontag', '2026-05-25', 'DE', 'Germany', false),
('German Unity Day', 'Tag der Deutschen Einheit', '2026-10-03', 'DE', 'Germany', true),
('Christmas Day', '1. Weihnachtstag', '2026-12-25', 'DE', 'Germany', true),
('Boxing Day', '2. Weihnachtstag', '2026-12-26', 'DE', 'Germany', true);

-- Insert Dubai/UAE Public Holidays 2026
INSERT INTO public.public_holidays (name, local_name, date, country_code, country_name, is_fixed) VALUES
('New Year''s Day', 'رأس السنة الميلادية', '2026-01-01', 'AE', 'UAE (Dubai)', true),
('Eid al-Fitr Day 1', 'عيد الفطر', '2026-03-30', 'AE', 'UAE (Dubai)', false),
('Eid al-Fitr Day 2', 'عيد الفطر', '2026-03-31', 'AE', 'UAE (Dubai)', false),
('Eid al-Fitr Day 3', 'عيد الفطر', '2026-04-01', 'AE', 'UAE (Dubai)', false),
('Eid al-Adha Day 1', 'عيد الأضحى', '2026-06-06', 'AE', 'UAE (Dubai)', false),
('Eid al-Adha Day 2', 'عيد الأضحى', '2026-06-07', 'AE', 'UAE (Dubai)', false),
('Eid al-Adha Day 3', 'عيد الأضحى', '2026-06-08', 'AE', 'UAE (Dubai)', false),
('Eid al-Adha Day 4', 'عيد الأضحى', '2026-06-09', 'AE', 'UAE (Dubai)', false),
('Islamic New Year', 'رأس السنة الهجرية', '2026-06-26', 'AE', 'UAE (Dubai)', false),
('Prophet''s Birthday', 'المولد النبوي', '2026-09-04', 'AE', 'UAE (Dubai)', false),
('Commemoration Day', 'يوم الشهيد', '2026-12-01', 'AE', 'UAE (Dubai)', true),
('UAE National Day', 'اليوم الوطني', '2026-12-02', 'AE', 'UAE (Dubai)', true),
('UAE National Day Holiday', 'اليوم الوطني', '2026-12-03', 'AE', 'UAE (Dubai)', true);