-- =====================================================
-- Add segment_id column + UNIQUE constraint for translation dedup
-- Prevents duplicate translation entries when multiple clients
-- (students, teacher) save the same translated segment
-- =====================================================

-- Step 1: Add segment_id column (LiveKit segment ID, e.g. "SG_abc123")
ALTER TABLE public.translation_entries
  ADD COLUMN IF NOT EXISTS segment_id TEXT;

-- Step 2: Clean existing duplicates (keep lowest id per session+language+text)
DELETE FROM public.translation_entries a
USING public.translation_entries b
WHERE a.id > b.id
  AND a.session_id = b.session_id
  AND a.language = b.language
  AND a.text = b.text;

-- Step 3: UNIQUE partial index on (session_id, language, segment_id)
-- Only applies where segment_id IS NOT NULL (new data going forward)
-- Old data with NULL segment_id is unaffected
CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_entries_dedup
  ON public.translation_entries(session_id, language, segment_id)
  WHERE segment_id IS NOT NULL;
