-- Add original_text column to translation_entries
-- Stores the original transcription text alongside the translation so that
-- bilingual downloads don't need to pair across tables (which breaks due to
-- different timestamps per participant and different granularity).
ALTER TABLE translation_entries
  ADD COLUMN IF NOT EXISTS original_text TEXT;
