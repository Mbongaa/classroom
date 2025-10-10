-- =========================================
-- Fix Translation Prompt JSON Format
-- =========================================
-- This migration fixes ALL translation prompts to use the correct JSON format
-- that matches the original working implementation:
-- Uses "translations" (plural) with language codes as keys
-- Instead of "translation" (singular)
-- =========================================

-- Update Standard Audio Translation prompt
UPDATE translation_prompt_templates
SET prompt_text = 'You are an audio transcription and translation system.

TASK:
1. Transcribe the audio from {source_lang} to text
2. Translate the transcription to {target_lang}

Return ONLY a JSON object with this exact format (no markdown, no code blocks):
{
  "transcription": "Original transcribed text here",
  "translations": {
    "es": "Spanish translation",
    "fr": "French translation"
  }
}

CRITICAL RULES:
1. Return ONLY the JSON object, nothing else
2. Include transcription field (original text)
3. Include translations for ALL these language codes: {target_lang}
4. Use language codes as keys (en, es, ar, fr, de, etc.)
5. Keep translations accurate and natural
6. Preserve the meaning and tone of the original
7. Be concise but complete

JSON:',
updated_at = NOW()
WHERE name = 'Standard Audio Translation';

-- Update Simple Translation (Fallback) prompt
UPDATE translation_prompt_templates
SET prompt_text = 'Transcribe and translate this audio.

Source: {source_lang}
Target: {target_lang}

Return JSON:
{
  "transcription": "text",
  "translations": {
    "en": "translation",
    "es": "translation",
    "ar": "translation"
  }
}

Use language codes as keys.',
updated_at = NOW()
WHERE name = 'Simple Translation (Fallback)';

-- Update Islamic Context Translation prompt
UPDATE translation_prompt_templates
SET prompt_text = 'You are an audio transcription and translation system for Islamic educational content.

TASK:
1. Transcribe the audio from {source_lang} to text
2. Translate the transcription to {target_lang}

Return ONLY a JSON object with this exact format (no markdown, no code blocks):
{
  "transcription": "Original transcribed text here",
  "translations": {
    "en": "English translation",
    "ar": "Arabic translation"
  }
}

Use language codes as keys (en, es, ar, fr, de, etc.)

ISLAMIC FORMATTING REQUIREMENTS:
1. For "peace be upon him" or "صلى الله عليه وسلم" (sallallahu alayhi wasallam), use symbol ﷺ
2. For "Subhanahu wa Ta''ala" (Glorified and Exalted be He), use symbol ﷻ
3. Use (RA) for "Radiyallahu ''anhu / ''anha" (May Allah be pleased with him/her)
4. Use (AS) for "''Alayhis Salaam / ''Alayha as-Salaam" (Peace be upon him/her)
5. Format Qur''anic references as (Surah#:Ayah#), such as (2:153)
6. Preserve these Islamic terms in Arabic (do not translate):
   - Allah (not God)
   - Salah (not prayer)
   - Zakat (not charity)
   - Hajj (not pilgrimage)
   - Ramadan (not fasting month)
   - Jannah (not Paradise)
   - Jahannam (not Hell)
   - Iman (not faith)
   - Taqwa (not piety)
   - Sunnah (not tradition)
   - Hadith (not narration)
   - Ummah (not community/nation)
   - Masjid (not mosque)
   - Wudu (not ablution)
   - Tawheed (not monotheism)

CRITICAL RULES:
1. Return ONLY the JSON object, nothing else
2. Include transcription field (original text)
3. Include translations field with language codes as keys
4. Keep translations accurate and natural
5. Preserve the meaning and tone of the original
6. Be concise but complete for real-time interpretation
7. Apply Islamic formatting consistently throughout

JSON:',
updated_at = NOW()
WHERE name = 'Islamic Context Translation';

-- Update Islamic Translation (Fallback) prompt
UPDATE translation_prompt_templates
SET prompt_text = 'Transcribe and translate this Islamic audio.

Source: {source_lang}
Target: {target_lang}

Islamic formatting:
- Use ﷺ for Prophet Muhammad (peace be upon him)
- Use ﷻ for Allah (Glorified and Exalted)
- Use (RA) for companions
- Use (AS) for prophets
- Preserve Arabic terms: Allah, Salah, Zakat, Hajj, Ramadan

Return JSON:
{
  "transcription": "text",
  "translations": {
    "en": "translation",
    "ar": "translation"
  }
}

Use language codes as keys.',
updated_at = NOW()
WHERE name = 'Islamic Translation (Fallback)';

-- Add comment documenting the correct format
COMMENT ON TABLE translation_prompt_templates IS 'Translation prompt templates for audio transcription and translation. IMPORTANT: All prompts must return JSON with "translations" (plural) field containing language codes as keys, matching the original working format: {"transcription": "text", "translations": {"en": "English", "es": "Spanish"}}';