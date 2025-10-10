"""
Gemini translator for audio transcription and multi-language translation
Uses Gemini multimodal API via Vertex AI to process audio bytes directly (no file I/O)
"""

import logging
import json
from typing import List, Dict

from google import genai
from google.genai import types

logger = logging.getLogger('voice-segmenter.translator')


class GeminiTranslator:
    """Handle audio transcription and translation using Gemini API via Vertex AI"""

    def __init__(self, project_id: str, location: str = 'us-central1'):
        """
        Initialize Gemini translator for Vertex AI

        Args:
            project_id: Google Cloud project ID
            location: Vertex AI region (default: us-central1)
        """
        # Initialize client for Vertex AI
        self.client = genai.Client(
            vertexai=True,
            project=project_id,
            location=location,
            http_options=types.HttpOptions(api_version='v1')  # Use stable v1 API
        )

        # Model name
        self.model_name = 'gemini-2.5-flash'

        # Configure safety settings for translation tasks
        self.safety_settings = [
            types.SafetySetting(
                category='HARM_CATEGORY_HARASSMENT',
                threshold='BLOCK_ONLY_HIGH'
            ),
            types.SafetySetting(
                category='HARM_CATEGORY_HATE_SPEECH',
                threshold='BLOCK_ONLY_HIGH'
            ),
            types.SafetySetting(
                category='HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold='BLOCK_ONLY_HIGH'
            ),
            types.SafetySetting(
                category='HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold='BLOCK_ONLY_HIGH'
            )
        ]

        self.cache = {}  # Translation cache
        self.custom_prompt = None  # Custom translation prompt from teacher
        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'cache_hits': 0
        }

        logger.info(f'✅ Gemini translator initialized via Vertex AI (project: {project_id}, location: {location}, model: {self.model_name})')

    async def process_audio_segment(
        self,
        wav_bytes: bytes,
        target_languages: List[str],
        source_language: str = 'English'
    ) -> Dict[str, any]:
        """
        Process audio segment: transcribe and translate

        Args:
            wav_bytes: WAV audio data (in-memory)
            target_languages: List of language codes to translate to
            source_language: Source language name (for context)

        Returns:
            Dictionary with transcription and translations:
            {
                'transcription': 'Original text',
                'translations': {
                    'es': 'Spanish translation',
                    'fr': 'French translation',
                    ...
                }
            }
        """
        if not wav_bytes:
            logger.warning('Empty audio bytes, skipping')
            return {'transcription': '', 'translations': {}}

        if not target_languages:
            logger.debug('No target languages, transcription only')
            target_languages = []

        self.stats['total_requests'] += 1

        logger.info(f'🌐 Processing audio with Gemini', extra={
            'audio_size': f'{len(wav_bytes) / 1024:.1f}KB',
            'target_languages': target_languages,
            'source': source_language
        })

        try:
            # Build prompt for transcription + translation
            prompt = self._build_prompt(source_language, target_languages)

            # Prepare audio data for Vertex AI
            audio_part = types.Part.from_bytes(
                data=wav_bytes,
                mime_type='audio/wav'
            )

            # Try up to 2 times with different prompts
            for attempt in range(2):
                try:
                    # Use simpler prompt on retry
                    if attempt == 1:
                        logger.info('🔄 Retrying with simpler prompt')
                        prompt = self._build_simple_prompt(source_language, target_languages)

                    # Call Vertex AI API with audio + prompt
                    response = await self.client.aio.models.generate_content(
                        model=self.model_name,
                        contents=[audio_part, types.Part.from_text(text=prompt)],
                        config=types.GenerateContentConfig(
                            temperature=0.3,
                            max_output_tokens=1000,
                            top_p=0.95,
                            top_k=40,
                            safety_settings=self.safety_settings
                        )
                    )

                    # Check if response was blocked by safety filters
                    if not response.candidates or not response.candidates[0].content.parts:
                        # Check the finish reason
                        finish_reason = response.candidates[0].finish_reason if response.candidates else None

                        if finish_reason == 2:  # SAFETY
                            logger.warning(f'⚠️ Response blocked by safety filters (attempt {attempt + 1})', extra={
                                'finish_reason': finish_reason,
                                'target_languages': target_languages,
                                'attempt': attempt + 1
                            })

                            if attempt == 0:
                                # Try again with simpler prompt
                                continue
                            else:
                                # Final attempt failed, return filtered message
                                return {
                                    'transcription': '[Content filtered for safety]',
                                    'translations': {lang: '[Content filtered for safety]' for lang in target_languages}
                                }
                        else:
                            logger.warning('⚠️ No valid response from Gemini', extra={
                                'finish_reason': finish_reason
                            })
                            raise ValueError(f'No valid response from Gemini, finish_reason: {finish_reason}')

                    # Success! Process the response
                    response_text = response.text

                    logger.debug(f'📥 Gemini response received', extra={
                        'response_length': len(response_text),
                        'attempt': attempt + 1
                    })

                    # Parse response
                    result = self._parse_response(response_text, target_languages)
                    break  # Success, exit retry loop

                except ValueError as e:
                    if attempt == 0:
                        continue  # Try again
                    else:
                        raise  # Re-raise on final attempt

            self.stats['successful_requests'] += 1

            logger.info(f'✅ Translation completed via Vertex AI', extra={
                'transcription': result['transcription'][:50] + '...' if len(result['transcription']) > 50 else result['transcription'],
                'languages': list(result['translations'].keys())
            })

            return result

        except Exception as e:
            self.stats['failed_requests'] += 1
            logger.error(f'❌ Vertex AI processing failed: {e}', exc_info=True)

            # Return empty result on error
            return {
                'transcription': '[Translation unavailable]',
                'translations': {lang: '[Translation unavailable]' for lang in target_languages}
            }

    def set_custom_prompt(self, prompt_text: str):
        """
        Set a custom translation prompt from the teacher/classroom settings

        Args:
            prompt_text: Custom prompt template with placeholders
        """
        self.custom_prompt = prompt_text
        logger.info(f'📋 Custom translation prompt set', extra={
            'prompt_length': len(prompt_text),
            'has_source_placeholder': '{source_lang}' in prompt_text,
            'has_target_placeholder': '{target_lang}' in prompt_text
        })

    def _build_prompt(self, source_language: str, target_languages: List[str]) -> str:
        """Build prompt for Gemini multimodal processing"""

        # Use custom prompt if available
        if self.custom_prompt and target_languages:
            language_names = self._get_language_names(target_languages)

            # Replace placeholders in custom prompt
            prompt = self.custom_prompt
            prompt = prompt.replace('{source_lang}', source_language)
            prompt = prompt.replace('{target_lang}', ', '.join(language_names))

            # Ensure JSON format instruction is included
            if 'JSON' not in prompt:
                prompt += f"""

Return ONLY a JSON object with this exact format (no markdown, no code blocks):
{{
  "transcription": "Original transcribed text here",
  "translations": {{
    {', '.join([f'"{lang}": "Translation in {self._get_language_names([lang])[0]}"' for lang in target_languages])}
  }}
}}

JSON:"""

            logger.debug(f'📋 Using custom translation prompt for {source_language} → {language_names}')
            return prompt

        # Default prompts (when no custom prompt is set)
        if target_languages:
            language_names = self._get_language_names(target_languages)

            return f"""You are an audio transcription and translation system.

TASK:
1. Transcribe the audio from {source_language} to text
2. Translate the transcription to these languages: {', '.join(language_names)}

Return ONLY a JSON object with this exact format (no markdown, no code blocks):
{{
  "transcription": "Original transcribed text here",
  "translations": {{
    "es": "Spanish translation",
    "fr": "French translation"
  }}
}}

REQUIREMENTS:
1. Return ONLY the JSON object, nothing else
2. Include transcription field (original text)
3. Include translations for ALL these language codes: {', '.join(target_languages)}
4. Keep translations accurate and natural
5. Preserve the meaning and tone of the original
6. Be concise but complete

JSON:"""
        else:
            # Transcription only (no translations)
            return f"""Transcribe this audio from {source_language} to text.

Return ONLY a JSON object:
{{
  "transcription": "Transcribed text here"
}}

JSON:"""

    def _build_simple_prompt(self, source_language: str, target_languages: List[str]) -> str:
        """Build a simpler prompt for retry attempts (less likely to trigger safety filters)"""

        # If we have a custom prompt, try simplifying it first
        if self.custom_prompt and target_languages:
            language_names = self._get_language_names(target_languages)

            # Simple version: just the core task
            return f"""Transcribe {source_language} audio and translate to {', '.join(language_names)}.

Return JSON format:
{{
  "transcription": "original text",
  "translations": {{
    {', '.join([f'"{lang}": "translation"' for lang in target_languages])}
  }}
}}"""

        # Default simple prompts
        if target_languages:
            language_names = self._get_language_names(target_languages)

            return f"""Transcribe and translate this audio.

Source: {source_language}
Target: {', '.join(language_names)}

Return JSON:
{{
  "transcription": "text",
  "translations": {{
    {', '.join([f'"{lang}": "translation"' for lang in target_languages])}
  }}
}}"""
        else:
            # Transcription only
            return f"""Transcribe audio to text.

Return JSON:
{{
  "transcription": "text"
}}"""

    def _parse_response(
        self,
        response_text: str,
        expected_languages: List[str]
    ) -> Dict[str, any]:
        """Parse Gemini JSON response"""
        try:
            # Clean response (remove markdown if present)
            cleaned = response_text.strip()
            cleaned = cleaned.replace('```json', '').replace('```', '').strip()

            # Sometimes Gemini adds extra text before JSON
            # Try to find JSON object
            if '{' in cleaned:
                start = cleaned.index('{')
                end = cleaned.rindex('}') + 1
                cleaned = cleaned[start:end]

            # Parse JSON
            parsed = json.loads(cleaned)

            # Validate structure
            transcription = parsed.get('transcription', '')
            translations = parsed.get('translations', {})

            # Fill missing languages with transcription as fallback
            for lang in expected_languages:
                if lang not in translations or not translations[lang]:
                    logger.warning(f'⚠️ Missing translation for {lang}, using transcription')
                    translations[lang] = transcription

            return {
                'transcription': transcription,
                'translations': translations
            }

        except Exception as e:
            logger.error(f'❌ Failed to parse Gemini response: {e}', extra={
                'response': response_text[:200]
            })

            # Return empty result
            return {
                'transcription': '',
                'translations': {}
            }

    def _get_language_names(self, codes: List[str]) -> List[str]:
        """Map language codes to full names for Gemini prompt"""
        names = {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'nl': 'Dutch',
            'ar': 'Arabic',
            'zh': 'Chinese',
            'ja': 'Japanese',
            'ko': 'Korean',
            'pt': 'Portuguese',
            'ru': 'Russian'
        }
        return [names.get(code, code.upper()) for code in codes]

    def get_statistics(self):
        """Get translator statistics"""
        return {
            **self.stats,
            'cache_size': len(self.cache),
            'success_rate': (self.stats['successful_requests'] / max(1, self.stats['total_requests'])) * 100
        }

    def clear_cache(self):
        """Clear translation cache"""
        size = len(self.cache)
        self.cache.clear()
        logger.info(f'🗑️ Cache cleared ({size} entries removed)')
