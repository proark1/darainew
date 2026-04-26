-- Vision-first capture.
--
-- One pipeline that turns a photo into the right downstream entity:
--   receipt          → financial_transactions + receipts row
--   business_card    → user_contacts row
--   medication       → personal_medications row
--   whiteboard       → notes row with extracted text
--   label            → translation displayed only (no entity)
--   document         → notes row with OCR text (or later: contract via existing scan-contract)
--
-- The vision_captures table tracks the lifecycle so a user can:
--   - see every photo they took and what was extracted
--   - re-classify or re-extract when the model gets it wrong
--   - audit which downstream rows came from which photo

CREATE TABLE IF NOT EXISTS public.vision_captures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  -- Storage info. We reuse the existing chat-attachments bucket so we
  -- don't need a new RLS surface; the path is `<userId>/vision/<uuid>.jpg`.
  bucket TEXT NOT NULL DEFAULT 'chat-attachments',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  -- Optional user hint ('this is a receipt'). When set we skip
  -- classification and go straight to the matching extractor.
  hint_kind TEXT,
  -- Detected kind from the classifier. 'unknown' is the fallback —
  -- we still surface the OCR text so the user can copy it manually.
  detected_kind TEXT NOT NULL DEFAULT 'unknown'
    CHECK (detected_kind IN (
      'receipt', 'business_card', 'medication', 'whiteboard',
      'label', 'document', 'contract', 'inventory', 'unknown'
    )),
  classification_confidence NUMERIC,
  -- Per-kind structured extraction. Shape varies:
  --   receipt        { merchant, total, currency, date, line_items[], category }
  --   business_card  { name, email, phone, company, role, website, address }
  --   medication     { name, dose, frequency, schedule, prescriber, refill_date }
  --   whiteboard     { title, summary, bullets[] }
  --   label          { source_language, translation, target_language }
  extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Plain text from OCR. Always populated when detection succeeds so
  -- the UI can fall back to "show me what you saw" even on unknowns.
  ocr_text TEXT,
  source_language TEXT,
  -- Lifecycle. The two-phase flow lets the user edit extracted fields
  -- before committing — important for receipts where amount accuracy
  -- matters.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'classifying', 'extracted', 'committed', 'discarded', 'error')),
  error_message TEXT,
  -- Back-ref to the row this capture committed into.
  created_entity_kind TEXT,
  created_entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vision_captures_user_recent_idx
  ON public.vision_captures (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS vision_captures_user_active_idx
  ON public.vision_captures (user_id, status, updated_at DESC)
  WHERE status NOT IN ('committed', 'discarded');

ALTER TABLE public.vision_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own vision captures"
  ON public.vision_captures FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own vision captures"
  ON public.vision_captures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Updates go through the edge functions (service role) so the
-- detected_kind / extracted fields can't be tampered with by the user
-- before commit. We expose UPDATE only for the discard path: the user
-- can mark `status = 'discarded'` themselves.
CREATE POLICY "Users discard own vision captures"
  ON public.vision_captures FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own vision captures"
  ON public.vision_captures FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_vision_captures_updated_at
  BEFORE UPDATE ON public.vision_captures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
