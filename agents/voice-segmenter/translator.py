"""
Gemini translator for audio transcription and multi-language translation
Uses Gemini multimodal API to process audio bytes directly (no file I/O)
"""

import logging
import json
import base64
from typing import List, Dict

import google.generativeai as genai

logger = logging.getLogger('voice-segmenter.translator')


class GeminiTranslator:
    """Handle audio transcription and translation using Gemini API"""

    def __init__(self, api_key: str):
        """
        Initialize Gemini translator

        Args:
            api_key: Google Gemini API key
        """
        genai.configure(api_key=api_key)

        # Use Gemini 2.5 Flash (same as Next.js gemini-translator.ts)
        self.model = genai.GenerativeModel(
            'gemini-2.5-flash',
            generation_config={
                'temperature': 0.3,
                'max_output_tokens': 1000,
                'top_p': 0.95,
                'top_k': 40
            }
        )

        self.cache = {}  # Translation cache
        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'cache_hits': 0
        }

        logger.info('✅ Gemini translator initialized (model: gemini-2.5-flash)')

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

            # Prepare audio data for Gemini (base64 encoded)
            audio_part = {
                'mime_type': 'audio/wav',
                'data': base64.b64encode(wav_bytes).decode('utf-8')
            }

            # Call Gemini API with audio + prompt
            response = await self.model.generate_content_async([
                audio_part,
                prompt
            ])

            response_text = response.text

            logger.debug(f'📥 Gemini response received', extra={
                'response_length': len(response_text)
            })

            # Parse response
            result = self._parse_response(response_text, target_languages)

            self.stats['successful_requests'] += 1

            logger.info(f'✅ Translation completed', extra={
                'transcription': result['transcription'][:50] + '...' if len(result['transcription']) > 50 else result['transcription'],
                'languages': list(result['translations'].keys())
            })

            return result

        except Exception as e:
            self.stats['failed_requests'] += 1
            logger.error(f'❌ Gemini processing failed: {e}', exc_info=True)

            # Return empty result on error
            return {
                'transcription': '[Translation unavailable]',
                'translations': {lang: '[Translation unavailable]' for lang in target_languages}
            }

    def _build_prompt(self, source_language: str, target_languages: List[str]) -> str:
        """Build prompt for Gemini multimodal processing"""

        if target_languages:
            language_names = self._get_language_names(target_languages)

            return f"""You are a professional simultaneous interpreter for classroom lectures.

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

CRITICAL RULES:
1. Return ONLY the JSON object, nothing else
2. Include transcription field (original text)
3. Include translations for ALL these language codes: {', '.join(target_languages)}
4. Keep translations natural and accurate
5. Maintain classroom/lecture tone
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
