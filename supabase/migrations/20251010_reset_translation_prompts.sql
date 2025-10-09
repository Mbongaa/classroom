-- =========================================
-- Reset Translation Prompt Templates
-- =========================================
-- This migration removes all old translation prompts and
-- replaces them with a single standard prompt that matches
-- the current voice-segmenter agent implementation
-- =========================================

-- Step 1: Delete all existing translation prompt templates
-- This includes both public defaults and organization-specific custom prompts
DELETE FROM translation_prompt_templates;

-- Step 2: Insert the new standard translation prompt
-- This prompt is based on the current voice-segmenter implementation
-- and uses neutral language to avoid triggering safety filters
INSERT INTO translation_prompt_templates (
  organization_id,
  name,
  description,
  prompt_text,
  category,
  is_public,
  created_at,
  updated_at
) VALUES (
  NULL, -- Public template
  'Standard Audio Translation',
  'Simple, neutral prompt for audio transcription and translation - optimized to avoid safety filter triggers',
  'You are an audio transcription and translation system.

TASK:
1. Transcribe the audio from {source_lang} to text
2. Translate the transcription to {target_lang}

Return a JSON object with this format:
{
  "transcription": "Original transcribed text",
  "translation": "Translated text in target language"
}

REQUIREMENTS:
1. Return ONLY the JSON object, nothing else
2. Include transcription field (original text)
3. Include translation field (translated text)
4. Keep translations accurate and natural
5. Preserve the meaning and tone of the original
6. Be concise but complete

JSON:',
  'standard',
  true,
  NOW(),
  NOW()
);

-- Optional: Add a simpler fallback prompt for retry scenarios
-- This is used when the main prompt triggers safety filters
INSERT INTO translation_prompt_templates (
  organization_id,
  name,
  description,
  prompt_text,
  category,
  is_public,
  created_at,
  updated_at
) VALUES (
  NULL, -- Public template
  'Simple Translation (Fallback)',
  'Minimal prompt for situations where the standard prompt is blocked - maximum simplicity',
  'Transcribe and translate this audio.

Source: {source_lang}
Target: {target_lang}

Return JSON:
{
  "transcription": "text",
  "translation": "translation"
}',
  'fallback',
  true,
  NOW(),
  NOW()
);

-- Step 3: Update any classrooms using deleted templates to use the new standard template
-- This ensures existing classrooms don't break
UPDATE classrooms
SET translation_prompt_id = (
  SELECT id FROM translation_prompt_templates
  WHERE name = 'Standard Audio Translation'
  AND is_public = true
  LIMIT 1
)
WHERE translation_prompt_id IS NOT NULL
  AND translation_prompt_id NOT IN (
    SELECT id FROM translation_prompt_templates
  );

-- Add comment for documentation
COMMENT ON TABLE translation_prompt_templates IS 'Translation prompt templates for audio transcription and translation - simplified after voice-segmenter integration';