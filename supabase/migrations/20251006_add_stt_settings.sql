-- =========================================
-- Add STT Settings to Classrooms
-- =========================================
-- This migration adds Speechmatics STT configuration columns
-- that Bayaan server can use for fine-tuning speech recognition

-- Add STT configuration columns to classrooms table
ALTER TABLE classrooms
  ADD COLUMN IF NOT EXISTS max_delay FLOAT DEFAULT 3.5,
  ADD COLUMN IF NOT EXISTS punctuation_sensitivity FLOAT DEFAULT 0.5;

-- Drop existing RPC function (can't change return type with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS get_classroom_translation_prompt(UUID);

-- Create new RPC function with STT settings
CREATE FUNCTION get_classroom_translation_prompt(classroom_uuid UUID)
RETURNS TABLE (
  prompt_text TEXT,
  transcription_language TEXT,
  context_window_size INT,
  max_delay FLOAT,
  punctuation_sensitivity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.prompt_text,
    c.transcription_language,
    c.context_window_size,
    c.max_delay,
    c.punctuation_sensitivity
  FROM classrooms c
  LEFT JOIN translation_prompt_templates pt ON c.translation_prompt_id = pt.id
  WHERE c.id = classroom_uuid
    AND c.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON COLUMN classrooms.max_delay IS 'Maximum delay in seconds before transcription is finalized (default: 3.5)';
COMMENT ON COLUMN classrooms.punctuation_sensitivity IS 'Punctuation sensitivity for speech recognition, 0.0-1.0 (default: 0.5)';
