"""
Gemini translator for audio transcription and multi-language translation
Uses Gemini multimodal API via Vertex AI to process audio bytes directly (no file I/O)
Includes conversation memory for better translation coherence
"""

import logging
import json
from typing import List, Dict
from collections import deque

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

        # Conversation memory (sliding window for context)
        self.context_enabled = True
        self.max_context_segments = 1  # Number of segment pairs to remember (reduced to prevent context pollution)
        self.conversation_history = deque(maxlen=self.max_context_segments * 2)  # 1 pair = 2 messages

        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'cache_hits': 0
        }

        logger.info(f'✅ Gemini translator initialized via Vertex AI (project: {project_id}, location: {location}, model: {self.model_name})')
        logger.info(f'🧠 Conversation memory: {"ENABLED" if self.context_enabled else "DISABLED"} (window: {self.max_context_segments} segments)')

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

            # Build conversation context (TEXT history only, not audio!)
            context_parts = self._build_context_parts()

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

                    # Build contents: [text context] + [current audio] + [prompt]
                    contents = context_parts + [audio_part, types.Part.from_text(text=prompt)]

                    # Call Vertex AI API with context + audio + prompt
                    response = await self.client.aio.models.generate_content(
                        model=self.model_name,
                        contents=contents,  # Includes conversation history!
                        config=types.GenerateContentConfig(
                            temperature=0.3,
                            max_output_tokens=8192,  # Increased to maximum to prevent truncation
                            top_p=0.95,
                            top_k=40,
                            safety_settings=self.safety_settings,
                            response_mime_type="application/json",  # Force JSON output
                            response_schema=self._build_response_schema(target_languages)  # Enforce exact language codes!
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

                except (ValueError, ConnectionError, TimeoutError, OSError) as e:
                    # Network errors, parsing errors, or OS-level connection issues
                    if attempt == 0:
                        logger.warning(f'⚠️ Attempt {attempt + 1} failed ({type(e).__name__}: {str(e)}), retrying...')
                        continue  # Try again
                    else:
                        raise  # Re-raise on final attempt

            self.stats['successful_requests'] += 1

            # Update conversation history for context in next request
            self._update_history(result['transcription'], result['translations'])

            logger.info(f'✅ Translation completed via Vertex AI', extra={
                'transcription': result['transcription'][:50] + '...' if len(result['transcription']) > 50 else result['transcription'],
                'languages': list(result['translations'].keys()),
                'context_size': f'{len(self.conversation_history)} msgs' if self.context_enabled else 'disabled'
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

    def _build_context_parts(self) -> List:
        """
        Build conversation history as Gemini Content parts (TEXT ONLY, not audio)

        Returns:
            List of Content objects representing conversation history
        """
        if not self.context_enabled or not self.conversation_history:
            return []

        context_parts = []
        for msg in self.conversation_history:
            content = types.Content(
                role=msg['role'],  # 'user' or 'model'
                parts=[types.Part.from_text(text=msg['content'])]  # TEXT only!
            )
            context_parts.append(content)

        logger.debug(f'📚 Built context with {len(self.conversation_history)} messages ({len(self.conversation_history) // 2} pairs)')
        return context_parts

    def _update_history(self, transcription: str, translations: Dict[str, str]):
        """
        Update conversation history with latest transcription and translation

        Args:
            transcription: Original transcribed text
            translations: Dictionary of language_code: translated_text
        """
        if not self.context_enabled:
            return

        # Add original transcription (user message)
        self.conversation_history.append({
            'role': 'user',
            'content': transcription
        })

        # Add translations (model response)
        # Format: "en: Peace be upon you, es: Paz sea con vosotros"
        translation_text = ', '.join([f"{lang}: {text}" for lang, text in translations.items()])
        self.conversation_history.append({
            'role': 'model',
            'content': translation_text
        })

        logger.debug(f'💾 History updated: {len(self.conversation_history)} messages ({len(self.conversation_history) // 2} pairs)')

    def clear_context(self):
        """Clear conversation history"""
        if self.context_enabled and self.conversation_history:
            size = len(self.conversation_history)
            self.conversation_history.clear()
            logger.info(f'🧹 Conversation history cleared ({size} messages removed)')

    def _build_response_schema(self, target_languages: List[str]) -> dict:
        """
        Build dynamic JSON schema enforcing exact language codes

        This ensures Gemini returns translations with the EXACT language codes
        the frontend expects, preventing mismatches like "arabic" vs "ar"

        Args:
            target_languages: List of language codes that MUST be present

        Returns:
            dict: JSON schema with required language codes
        """
        if not target_languages:
            # Transcription only (no translations)
            return {
                'type': 'OBJECT',
                'required': ['transcription'],
                'properties': {
                    'transcription': {'type': 'STRING'}
                }
            }

        # Build translation properties with exact language codes as required fields
        translation_properties = {
            lang: {'type': 'STRING'} for lang in target_languages
        }

        return {
            'type': 'OBJECT',
            'required': ['transcription', 'translations'],
            'properties': {
                'transcription': {'type': 'STRING'},
                'translations': {
                    'type': 'OBJECT',
                    'required': target_languages,  # Enforce exact language codes!
                    'properties': translation_properties
                }
            }
        }

    def _build_prompt(self, source_language: str, target_languages: List[str]) -> str:
        """Build prompt for Gemini multimodal processing"""

        # Use custom prompt if available
        if self.custom_prompt and target_languages:
            language_names = self._get_language_names(target_languages)

            # Log validation: codes → names mapping
            logger.info(f'🔤 Language mapping validation:', extra={
                'codes': target_languages,
                'resolved_names': language_names,
                'mapping': {code: name for code, name in zip(target_languages, language_names)}
            })

            # Replace placeholders in custom prompt
            prompt = self.custom_prompt
            prompt = prompt.replace('{source_lang}', source_language)
            prompt = prompt.replace('{target_lang}', ', '.join(language_names))

            # ALWAYS append explicit language code requirements (fixes first segment ambiguity)
            prompt += f"""

IMPORTANT: Use these EXACT language codes as keys in your translations object:
{', '.join(target_languages)}

Your response MUST use these exact keys. Example format:
{{
  "transcription": "original text",
  "translations": {{
    {', '.join([f'"{lang}": "translation text"' for lang in target_languages])}
  }}
}}
"""

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

            # Log validation: codes → names mapping
            logger.info(f'🔤 Language mapping validation (default prompt):', extra={
                'codes': target_languages,
                'resolved_names': language_names,
                'mapping': {code: name for code, name in zip(target_languages, language_names)}
            })

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
        """Parse Gemini JSON response with robust error handling"""
        try:
            # Clean response (remove markdown if present)
            cleaned = response_text.strip()
            cleaned = cleaned.replace('```json', '').replace('```', '').strip()

            # Sometimes Gemini adds extra text before JSON
            # Try to find JSON object
            if '{' in cleaned:
                start = cleaned.index('{')

                # Safely find the end of JSON, handle truncated responses
                try:
                    end = cleaned.rindex('}') + 1
                    cleaned = cleaned[start:end]
                except ValueError:
                    # No closing brace found - response is truncated
                    logger.warning('⚠️ Truncated JSON response detected, attempting repair')
                    cleaned = cleaned[start:]

                    # Attempt to repair incomplete JSON
                    # Count opening and closing braces to determine what's missing
                    open_braces = cleaned.count('{')
                    close_braces = cleaned.count('}')
                    missing_braces = open_braces - close_braces

                    if missing_braces > 0:
                        # Add missing closing braces
                        cleaned += '}' * missing_braces
                        logger.debug(f'🔧 Added {missing_braces} closing braces to repair JSON')

            # Parse JSON
            parsed = json.loads(cleaned)

            # Validate structure
            transcription = parsed.get('transcription', '')
            translations = parsed.get('translations', {})

            # Validate that all expected language codes are present
            # NOTE: With the dynamic schema enforcing exact codes, this should rarely trigger
            for lang in expected_languages:
                if lang not in translations or not translations[lang]:
                    logger.error(f'❌ Schema enforcement failed: Missing translation for {lang}')
                    translations[lang] = '[Translation error - schema mismatch]'

            return {
                'transcription': transcription,
                'translations': translations
            }

        except json.JSONDecodeError as e:
            logger.error(f'❌ JSON decode error: {e}', extra={
                'response': response_text[:200],
                'error_position': f'line {e.lineno}, col {e.colno}'
            })

            # Attempt to extract transcription at least
            transcription = self._extract_transcription_fallback(response_text)

            # NOTE: With schema enforcement, JSON decode errors should be rare
            # Don't use English transcription as fake translation
            return {
                'transcription': transcription,
                'translations': {lang: '[Translation unavailable - JSON error]' for lang in expected_languages}
            }

        except Exception as e:
            logger.error(f'❌ Failed to parse Gemini response: {e}', extra={
                'response': response_text[:200],
                'error_type': type(e).__name__
            })

            # Return empty result
            return {
                'transcription': '',
                'translations': {}
            }

    def _extract_transcription_fallback(self, response_text: str) -> str:
        """Extract transcription from malformed response as fallback"""
        try:
            # Try to find transcription field even in malformed JSON
            if '"transcription"' in response_text:
                # Extract text after "transcription": "
                start = response_text.find('"transcription"')
                if start != -1:
                    # Find the opening quote after the colon
                    quote_start = response_text.find('"', start + len('"transcription"') + 1)
                    if quote_start != -1:
                        # Find the closing quote (handle escaped quotes)
                        quote_end = quote_start + 1
                        while quote_end < len(response_text):
                            if response_text[quote_end] == '"' and response_text[quote_end - 1] != '\\':
                                transcription = response_text[quote_start + 1:quote_end]
                                logger.info(f'✅ Extracted transcription from malformed response')
                                return transcription
                            quote_end += 1
        except Exception as e:
            logger.debug(f'Fallback extraction failed: {e}')

        return '[Translation unavailable]'

    def _get_language_names(self, codes: List[str]) -> List[str]:
        """Map language codes to full names for Gemini prompt"""
        names = {
            # Common ISO 639-1 codes
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
            'ru': 'Russian',
            'tr': 'Turkish',
            'it': 'Italian',
            'pl': 'Polish',
            'sv': 'Swedish',
            'no': 'Norwegian',
            'da': 'Danish',
            'fi': 'Finnish',
            'cs': 'Czech',
            'hu': 'Hungarian',
            'ro': 'Romanian',
            'bg': 'Bulgarian',
            'hr': 'Croatian',
            'sk': 'Slovakian',
            'sl': 'Slovenian',
            'et': 'Estonian',
            'lv': 'Latvian',
            'lt': 'Lithuanian',
            'el': 'Greek',
            'he': 'Hebrew',
            'hi': 'Hindi',
            'bn': 'Bengali',
            'ur': 'Urdu',
            'fa': 'Persian',
            'th': 'Thai',
            'vi': 'Vietnamese',
            'id': 'Indonesian',
            'ms': 'Malay',
            'tl': 'Tagalog',
            'sw': 'Swahili',
            'ta': 'Tamil',
            'te': 'Telugu',
            'mr': 'Marathi',
            'uk': 'Ukrainian',
            'be': 'Belarusian',
            'ca': 'Catalan',
            'gl': 'Galician',
            'eu': 'Basque',
            'cy': 'Welsh',
            'ga': 'Irish',

            # ISO 639-3 codes (extended support for specific variants)
            'yue': 'Cantonese',
            'ba': 'Bashkir',
            'eo': 'Esperanto',
            'ia': 'Interlingua',
            'mt': 'Maltese',
            'mn': 'Mongolian',
            'ug': 'Uyghur',

            # Chinese variants (BCP 47 locale codes)
            'zh-CN': 'Simplified Chinese',  # Primary: Mandarin (Mainland China)
            'zh-TW': 'Traditional Chinese',  # Taiwan
            'zh-HK': 'Hong Kong Chinese',    # Hong Kong
        }
        return [names.get(code, code.upper()) for code in codes]

    def get_statistics(self):
        """Get translator statistics"""
        return {
            **self.stats,
            'cache_size': len(self.cache),
            'success_rate': (self.stats['successful_requests'] / max(1, self.stats['total_requests'])) * 100,
            'context_enabled': self.context_enabled,
            'context_size': len(self.conversation_history) if self.context_enabled else 0,
            'context_pairs': len(self.conversation_history) // 2 if self.context_enabled else 0
        }

    def clear_cache(self):
        """Clear translation cache"""
        size = len(self.cache)
        self.cache.clear()
        logger.info(f'🗑️ Cache cleared ({size} entries removed)')
