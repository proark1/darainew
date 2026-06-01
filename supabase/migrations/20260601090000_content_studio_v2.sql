-- Content Studio v2 — idea source mode + length controls.
--
-- Adds per-creator controls:
--   * idea_source    — where ideas come from: 'mixed' (trending + evergreen),
--                      'trending' (live web only), or 'knowledge' (the model's
--                      own expertise, no news required).
--   * default_format — which scripts to write by default: 'short', 'long', 'both'.
--   * short_seconds  — target spoken length for short-form scripts.
--   * long_minutes   — target length for long-form (YouTube) scripts.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, so re-running is safe.

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS idea_source    text NOT NULL DEFAULT 'mixed'
    CHECK (idea_source IN ('mixed', 'trending', 'knowledge')),
  ADD COLUMN IF NOT EXISTS default_format text NOT NULL DEFAULT 'both'
    CHECK (default_format IN ('short', 'long', 'both')),
  ADD COLUMN IF NOT EXISTS short_seconds  int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS long_minutes   int NOT NULL DEFAULT 6;

NOTIFY pgrst, 'reload schema';
