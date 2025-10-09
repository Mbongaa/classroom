"""
Audio processor with Silero VAD segmentation (in-memory processing)
No file saving - audio buffers processed in RAM and discarded
"""

import asyncio
import logging
import io
import wave
from datetime import datetime

from livekit import rtc
from livekit.plugins import silero
from livekit.agents import vad, utils

logger = logging.getLogger('voice-segmenter.audio_processor')


class AudioProcessor:
    """Process audio with VAD segmentation (in-memory only)"""

    def __init__(self, vad_model, translator=None, room=None):
        """
        Initialize audio processor

        Args:
            vad_model: Loaded Silero VAD model
            translator: Optional Gemini translator for Phase 3
            room: LiveKit room for publishing transcriptions
        """
        self.vad = vad_model
        self.translator = translator
        self.room = room
        self.active_languages = set()
        self.segment_count = 0
        self.total_segments_processed = 0

        # Source language tracking (teacher's language)
        self.source_language = 'English'  # Default language name
        self.source_language_code = 'en'  # Default language code

        logger.info('✅ Audio processor initialized (in-memory mode)')

    async def process_track(
        self,
        track: rtc.Track,
        participant: rtc.RemoteParticipant,
        room_name: str
    ):
        """
        Process audio track with VAD segmentation

        Args:
            track: LiveKit audio track
            participant: Participant who owns the track
            room_name: Name of the room
        """
        logger.info(f'🎧 Starting audio processing for: {participant.identity}')
        logger.info(f'📂 Processing room: {room_name}')

        try:
            # Create audio stream from track
            audio_stream = rtc.AudioStream(track)
            logger.info('✅ Audio stream created')

            # Apply VAD to stream
            logger.info('🔊 Starting VAD segmentation...')
            vad_stream = self.vad.stream()

            # Create two concurrent tasks:
            # 1. Push audio frames to VAD
            # 2. Process VAD events
            async def push_audio_frames():
                """Push audio frames from track to VAD"""
                try:
                    async for event in audio_stream:
                        vad_stream.push_frame(event.frame)
                except Exception as e:
                    logger.error(f'Error pushing audio frames: {e}')
                finally:
                    await vad_stream.aclose()

            async def process_vad_events():
                """Process VAD events and extract speech segments"""
                try:
                    async for vad_event in vad_stream:
                        if vad_event.type == vad.VADEventType.START_OF_SPEECH:
                            logger.debug('🎤 Speech started')

                        elif vad_event.type == vad.VADEventType.END_OF_SPEECH:
                            logger.info('🎤 Speech ended')

                            # Get speech frames from VAD event
                            if vad_event.frames and len(vad_event.frames) > 0:
                                self.segment_count += 1
                                self.total_segments_processed += 1

                                # Get sample rate from first frame
                                sample_rate = vad_event.frames[0].sample_rate if hasattr(vad_event.frames[0], 'sample_rate') else 16000

                                # Calculate duration
                                total_samples = sum(len(frame.data) // 2 for frame in vad_event.frames)
                                duration = total_samples / sample_rate

                                # Convert to WAV bytes (in-memory)
                                wav_bytes = self.convert_to_wav_bytes(
                                    vad_event.frames,
                                    sample_rate=sample_rate
                                )

                                if wav_bytes:
                                    size_kb = len(wav_bytes) / 1024

                                    logger.info(f'✅ Speech segment detected', extra={
                                        'segment': self.segment_count,
                                        'duration': f'{duration:.1f}s',
                                        'size': f'{size_kb:.1f}KB',
                                        'sample_rate': sample_rate,
                                        'languages': list(self.active_languages)
                                    })

                                    # Phase 3: Translate with Gemini
                                    if self.translator and self.active_languages:
                                        await self.translate_and_publish(
                                            wav_bytes,
                                            list(self.active_languages)
                                        )
                                    else:
                                        logger.info(f'💾 WAV bytes prepared (no translation - no active languages)')

                except Exception as e:
                    logger.error(f'Error processing VAD events: {e}')

            # Run both tasks concurrently
            await asyncio.gather(
                push_audio_frames(),
                process_vad_events()
            )

        except asyncio.CancelledError:
            logger.info('🛑 Audio processing cancelled')
        except Exception as e:
            logger.error(f'❌ Audio processing error: {e}', exc_info=True)

        logger.info(f'🏁 Audio processing completed for {participant.identity}')

    async def translate_and_publish(self, wav_bytes: bytes, target_languages: list):
        """Send audio to Gemini and publish translations to LiveKit"""
        try:
            # Call Gemini to transcribe and translate
            result = await self.translator.process_audio_segment(
                wav_bytes,
                target_languages,
                source_language=self.source_language  # Use tracked teacher language
            )

            transcription = result.get('transcription', '')
            translations = result.get('translations', {})

            logger.info(f'📝 Transcription: "{transcription}"')

            # Publish original transcription first (in source language)
            if self.room and transcription:
                await self.publish_transcription(
                    transcription,
                    self.source_language_code
                )
                logger.info(f'✅ Published original transcription in {self.source_language}')

            # Then publish translations to LiveKit
            if self.room and translations:
                for lang_code, translation_text in translations.items():
                    await self.publish_transcription(
                        translation_text,
                        lang_code
                    )

                logger.info(f'✅ Published {len(translations)} translations to LiveKit')

        except Exception as e:
            logger.error(f'❌ Translation and publish failed: {e}')

    async def publish_transcription(self, text: str, language: str):
        """Publish transcription to LiveKit"""
        try:
            segment = rtc.TranscriptionSegment(
                id=utils.shortuuid('SG_'),
                text=text,
                start_time=0,
                end_time=0,
                language=language,
                final=True
            )

            transcription = rtc.Transcription(
                participant_identity=self.room.local_participant.identity,
                track_sid='',
                segments=[segment]
            )

            await self.room.local_participant.publish_transcription(transcription)

            logger.debug(f'📤 Published transcription: {language} - "{text[:30]}..."')

        except Exception as e:
            logger.error(f'❌ Failed to publish transcription: {e}')

    def convert_to_wav_bytes(self, frames, sample_rate=16000):
        """
        Convert audio frames to WAV format bytes (in-memory, no file I/O)

        Args:
            frames: List of audio frames from VAD (rtc.AudioFrame objects)
            sample_rate: Sample rate (default 16000 Hz)

        Returns:
            bytes: WAV formatted audio data ready for Gemini API
        """
        try:
            # Create in-memory buffer (no disk I/O!)
            buffer = io.BytesIO()

            # Write WAV format to buffer
            with wave.open(buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(sample_rate)

                # Write all frames to buffer
                for frame in frames:
                    # frame.data is already bytes (int16 PCM)
                    wav_file.writeframes(frame.data.tobytes())

            # Get bytes from buffer
            buffer.seek(0)
            wav_bytes = buffer.read()

            logger.debug(f'✅ Converted {len(frames)} frames to {len(wav_bytes)} bytes')

            return wav_bytes

        except Exception as e:
            logger.error(f'❌ Failed to convert frames to WAV bytes: {e}', exc_info=True)
            return None

    def add_language(self, language_code: str):
        """Add language to active translation list"""
        if language_code not in self.active_languages:
            self.active_languages.add(language_code)
            logger.info(f'➕ Language added: {language_code}', extra={
                'total_active': len(self.active_languages),
                'languages': list(self.active_languages)
            })

    def remove_language(self, language_code: str):
        """Remove language from active translation list"""
        if language_code in self.active_languages:
            self.active_languages.remove(language_code)
            logger.info(f'➖ Language removed: {language_code}', extra={
                'total_active': len(self.active_languages)
            })

    def get_active_languages(self):
        """Get list of active languages"""
        return list(self.active_languages)

    def set_source_language(self, language_code: str):
        """
        Set the source language (teacher's language)

        Args:
            language_code: Language code (e.g., 'en', 'es', 'ar')
        """
        self.source_language_code = language_code
        self.source_language = self._get_language_name(language_code)
        logger.info(f'🎤 Source language set to: {self.source_language} ({language_code})')

    def _get_language_name(self, code: str) -> str:
        """Map language code to full name"""
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
            'ru': 'Russian',
            'hi': 'Hindi',
            'it': 'Italian'
        }
        return names.get(code, code.upper())

    def get_statistics(self):
        """Get processing statistics"""
        stats = {
            'total_segments': self.total_segments_processed,
            'active_languages': len(self.active_languages),
            'languages': list(self.active_languages),
            'source_language': f'{self.source_language} ({self.source_language_code})'
        }

        if self.translator:
            stats['translator'] = self.translator.get_statistics()

        return stats
