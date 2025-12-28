-- Create quran_hifz_progress table for tracking memorization
CREATE TABLE public.quran_hifz_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  surah_number INTEGER NOT NULL,
  surah_name TEXT NOT NULL,
  surah_name_arabic TEXT NOT NULL,
  total_ayahs INTEGER NOT NULL,
  memorized_ayahs INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started, in_progress, memorized, needs_revision
  last_revised_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, surah_number)
);

-- Enable Row Level Security
ALTER TABLE public.quran_hifz_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own hifz progress" 
ON public.quran_hifz_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own hifz progress" 
ON public.quran_hifz_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hifz progress" 
ON public.quran_hifz_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hifz progress" 
ON public.quran_hifz_progress 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_quran_hifz_user_id ON public.quran_hifz_progress(user_id);
CREATE INDEX idx_quran_hifz_status ON public.quran_hifz_progress(status);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_quran_hifz_updated_at
BEFORE UPDATE ON public.quran_hifz_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();