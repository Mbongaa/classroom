import asyncio
import json
import logging
import time
from dataclasses import dataclass, asdict
from typing import Dict, Optional, Any
from collections import deque
from datetime import datetime

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    JobContext,
    JobRequest,
    WorkerOptions,
    cli,
    llm,
    utils,
)
from livekit.plugins import openai

# Load environment variables from .env file
load_dotenv()

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("translation-agent-upgraded")

# Supported languages for translation
@dataclass
class Language:
    code: str
    name: str
    flag: str

SUPPORTED_LANGUAGES = {
    "en": Language(code="en", name="English", flag="🇺🇸"),
    "es": Language(code="es", name="Spanish", flag="🇪🇸"),
    "fr": Language(code="fr", name="French", flag="🇫🇷"),
    "de": Language(code="de", name="German", flag="🇩🇪"),
    "ja": Language(code="ja", name="Japanese", flag="🇯🇵"),
    "ar": Language(code="ar", name="Arabic", flag="🇸🇦"),
    "zh": Language(code="zh", name="Chinese", flag="🇨🇳"),
    "pt": Language(code="pt", name="Portuguese", flag="🇵🇹"),
    "ru": Language(code="ru", name="Russian", flag="🇷🇺"),
    "ko": Language(code="ko", name="Korean", flag="🇰🇷"),
}

# Performance monitoring class
class PerformanceMonitor:
    """Monitors and logs performance metrics for transcription and translation"""

    def __init__(self, window_size: int = 100):
        self.transcription_times = deque(maxlen=window_size)
        self.translation_times = deque(maxlen=window_size)
        self.error_count = 0
        self.success_count = 0
        self.start_time = time.time()

    def record_transcription(self, duration: float):
        """Record transcription processing time"""
        self.transcription_times.append(duration)

    def record_translation(self, duration: float):
        """Record translation processing time"""
        self.translation_times.append(duration)

    def record_error(self):
        """Record an error occurrence"""
        self.error_count += 1

    def record_success(self):
        """Record a successful operation"""
        self.success_count += 1

    def get_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        uptime = time.time() - self.start_time

        metrics = {
            "uptime_seconds": uptime,
            "total_success": self.success_count,
            "total_errors": self.error_count,
            "error_rate": self.error_count / max(1, self.success_count + self.error_count),
        }

        if self.transcription_times:
            metrics["avg_transcription_ms"] = sum(self.transcription_times) / len(self.transcription_times) * 1000
            metrics["max_transcription_ms"] = max(self.transcription_times) * 1000
            metrics["min_transcription_ms"] = min(self.transcription_times) * 1000

        if self.translation_times:
            metrics["avg_translation_ms"] = sum(self.translation_times) / len(self.translation_times) * 1000
            metrics["max_translation_ms"] = max(self.translation_times) * 1000
            metrics["min_translation_ms"] = min(self.translation_times) * 1000

        return metrics

    def log_metrics(self):
        """Log current metrics"""
        metrics = self.get_metrics()
        logger.info(f"Performance Metrics: {json.dumps(metrics, indent=2)}")

# Enhanced Translator class with GPT-4o
class Translator:
    def __init__(self, room: rtc.Room, language: Language, performance_monitor: PerformanceMonitor):
        self.room = room
        self.language = language
        self.performance_monitor = performance_monitor

        # Use GPT-4o for translation with optimized configuration
        self.llm = openai.LLM(
            model="gpt-4o",
            temperature=0.3,  # Lower temperature for more consistent translations
            max_tokens=500,   # Reasonable limit for translations
        )

        # Create optimized ChatContext for translation
        self.chat_ctx = llm.ChatContext()

        # Enhanced system prompt for GPT-4o
        system_prompt = (
            f"You are a professional real-time translator specializing in {language.name}. "
            f"Your task is to provide accurate, natural-sounding translations while preserving:\n"
            f"1. The speaker's tone and intent\n"
            f"2. Technical terminology and proper nouns\n"
            f"3. Cultural context and idioms where appropriate\n\n"
            f"Rules:\n"
            f"- Translate the input text directly to {language.name}\n"
            f"- Keep translations concise and clear\n"
            f"- Preserve formatting and punctuation\n"
            f"- Do not add explanations or comments\n"
            f"- Respond ONLY with the translated text"
        )

        self.chat_ctx.add_message(role="system", content=system_prompt)

        # Cache for repeated phrases (optional optimization)
        self.translation_cache = {}
        self.cache_hits = 0

    async def translate(self, message: str, track_sid: str):
        """Translate a message to the target language with caching and error handling"""
        start_time = time.time()

        try:
            # Check cache first (optional optimization)
            cache_key = f"{message}:{self.language.code}"
            if cache_key in self.translation_cache:
                translated_message = self.translation_cache[cache_key]
                self.cache_hits += 1
                logger.debug(f"Cache hit for translation to {self.language.name}")
            else:
                # Add the user's message to the chat context
                self.chat_ctx.add_message(role="user", content=message)

                # Get the translation from GPT-4o
                stream = self.llm.chat(chat_ctx=self.chat_ctx)
                translated_message = ""

                async for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        translated_message += chunk.choices[0].delta.content

                # Cache the translation
                if len(self.translation_cache) < 1000:  # Limit cache size
                    self.translation_cache[cache_key] = translated_message

            # Record performance metrics
            duration = time.time() - start_time
            self.performance_monitor.record_translation(duration)
            self.performance_monitor.record_success()

            # Create and publish the transcription segment
            segment = rtc.TranscriptionSegment(
                id=utils.misc.shortuuid("SG_"),
                text=translated_message,
                language=self.language.code,
                start_time=0,
                end_time=0,
                final=True,
            )

            transcription_obj = rtc.Transcription(
                participant_identity=self.room.local_participant.identity,
                track_sid=track_sid,
                segments=[segment],
            )

            await self.room.local_participant.publish_transcription(transcription_obj)
            logger.info(f"Translated to {self.language.name} ({duration*1000:.1f}ms): {translated_message[:100]}...")

        except Exception as e:
            self.performance_monitor.record_error()
            logger.error(f"Translation error for {self.language.name}: {e}", exc_info=True)

            # Fallback: Send original message with error indicator
            try:
                error_segment = rtc.TranscriptionSegment(
                    id=utils.misc.shortuuid("ERR_"),
                    text=f"[Translation Error] {message}",
                    language=self.language.code,
                    start_time=0,
                    end_time=0,
                    final=True,
                )

                error_transcription = rtc.Transcription(
                    participant_identity=self.room.local_participant.identity,
                    track_sid=track_sid,
                    segments=[error_segment],
                )

                await self.room.local_participant.publish_transcription(error_transcription)
            except Exception as fallback_error:
                logger.error(f"Failed to send error fallback: {fallback_error}")

# Enhanced RealtimeTranscriber using OpenAI Realtime API
class RealtimeTranscriber:
    """Handles real-time transcription using OpenAI's Realtime API with WebSocket"""

    def __init__(self, performance_monitor: PerformanceMonitor):
        self.performance_monitor = performance_monitor

        # Initialize OpenAI Realtime model for STT with VAD
        self.realtime_model = openai.realtime.RealtimeModel(
            instructions="You are a transcription assistant. Transcribe speech accurately.",
            voice=None,  # No voice needed for transcription-only
            temperature=0.0,  # Deterministic for transcription
            max_response_output_tokens=None,  # No response needed
            modalities=["text"],  # Text output only
            turn_detection=openai.realtime.ServerVadOptions(
                threshold=0.5,  # VAD sensitivity (0.0-1.0, lower = more sensitive)
                prefix_padding_ms=300,  # Padding before speech starts
                silence_duration_ms=500,  # Silence duration to end turn
            ),
        )

        self.active = False
        self.session = None

    async def start(self, track: rtc.Track, on_transcription_callback):
        """Start the real-time transcription session"""
        self.active = True
        self.on_transcription = on_transcription_callback

        try:
            # Create a session for real-time transcription
            self.session = self.realtime_model.session()

            # Set up audio stream from LiveKit track
            audio_stream = rtc.AudioStream(track)

            # Process audio through the Realtime API
            async for audio_event in audio_stream:
                if not self.active:
                    break

                start_time = time.time()

                try:
                    # Send audio to the Realtime API
                    # The Realtime API handles VAD and punctuation internally
                    await self.session.input_audio_buffer.append(
                        audio=audio_event.frame.data
                    )

                    # Check for completed transcriptions
                    # The Realtime API will emit events when speech segments are complete
                    async for event in self.session.events():
                        if event.type == "input_audio_buffer.speech_stopped":
                            # Speech segment completed, get the transcription
                            transcription = await self._get_transcription()
                            if transcription:
                                duration = time.time() - start_time
                                self.performance_monitor.record_transcription(duration)
                                self.performance_monitor.record_success()

                                # Trigger the callback with the transcribed text
                                await self.on_transcription(transcription, track)
                                logger.info(f"Transcribed ({duration*1000:.1f}ms): {transcription[:100]}...")

                except Exception as e:
                    self.performance_monitor.record_error()
                    logger.error(f"Realtime transcription error: {e}", exc_info=True)

        except Exception as e:
            logger.error(f"Failed to start realtime transcription: {e}", exc_info=True)
        finally:
            await self.stop()

    async def _get_transcription(self) -> Optional[str]:
        """Get the transcribed text from the Realtime API"""
        try:
            # Get the conversation items
            items = self.session.conversation.items
            if items and items[-1].type == "message":
                # Extract text from the last message
                content = items[-1].content
                if content and len(content) > 0:
                    return content[0].text
        except Exception as e:
            logger.error(f"Error extracting transcription: {e}")
        return None

    async def stop(self):
        """Stop the transcription session"""
        self.active = False
        if self.session:
            try:
                await self.session.close()
            except Exception as e:
                logger.error(f"Error closing realtime session: {e}")
            self.session = None

# Main entrypoint for the agent
async def entrypoint(ctx: JobContext):
    """Main entry point for the translation agent with enhanced error handling"""

    # Initialize performance monitoring
    performance_monitor = PerformanceMonitor()

    # Schedule periodic metrics logging
    async def log_metrics_periodically():
        while True:
            await asyncio.sleep(60)  # Log metrics every minute
            performance_monitor.log_metrics()

    metrics_task = asyncio.create_task(log_metrics_periodically())

    try:
        # Initialize components
        translators: Dict[str, Translator] = {}
        active_tasks = []
        teacher_track = None
        transcriber = None

        # Function to handle transcriptions from the Realtime API
        async def handle_transcription(text: str, track: rtc.Track):
            """Handle transcribed text and forward to translators"""
            logger.info(f"Transcribed from teacher: {text[:100]}...")

            # Send to all active translators in parallel
            translation_tasks = []
            for translator in translators.values():
                task = asyncio.create_task(translator.translate(text, track.sid))
                translation_tasks.append(task)
                active_tasks.append(task)
                task.add_done_callback(lambda t: active_tasks.remove(t) if t in active_tasks else None)

            # Wait for all translations to complete (optional)
            if translation_tasks:
                await asyncio.gather(*translation_tasks, return_exceptions=True)

        # Function to start transcribing a teacher's track
        async def transcribe_teacher_track(participant: rtc.Participant, track: rtc.Track):
            """Start transcribing the teacher's audio track using Realtime API"""
            nonlocal transcriber

            # Get teacher's speaking language from attributes
            teacher_language = "en"  # Default to English
            if participant.attributes:
                teacher_language = participant.attributes.get("speaking_language", "en")
                logger.info(f"Teacher speaking language: {teacher_language}")

            # Initialize and start the Realtime transcriber
            transcriber = RealtimeTranscriber(performance_monitor)
            await transcriber.start(track, handle_transcription)

        # Function to check if a participant is a teacher
        def is_teacher(participant: rtc.Participant) -> bool:
            try:
                if participant.metadata:
                    meta = json.loads(participant.metadata)
                    return meta.get("role") == "teacher"
            except (json.JSONDecodeError, AttributeError) as e:
                logger.debug(f"Could not parse metadata for {participant.identity}: {e}")
            return False

        # Function to find and start transcribing the teacher
        def find_and_transcribe_teacher():
            nonlocal teacher_track
            # Check existing participants
            for p in ctx.room.remote_participants.values():
                if is_teacher(p):
                    # Find audio track
                    for pub in p.track_publications.values():
                        if pub.kind == rtc.TrackKind.KIND_AUDIO and pub.track:
                            logger.info(f"Found teacher '{p.identity}', starting transcription.")
                            teacher_track = pub.track
                            task = asyncio.create_task(transcribe_teacher_track(p, pub.track))
                            active_tasks.append(task)
                            task.add_done_callback(lambda t: active_tasks.remove(t) if t in active_tasks else None)
                            return True
            logger.info("No teacher found yet.")
            return False

        # Event handler for new participants
        @ctx.room.on("participant_connected")
        def on_participant_connected(participant: rtc.RemoteParticipant):
            logger.info(f"Participant connected: {participant.identity}")
            if not teacher_track and is_teacher(participant):
                # Wait a bit for tracks to be published
                asyncio.create_task(check_teacher_tracks_delayed(participant))

        async def check_teacher_tracks_delayed(participant: rtc.RemoteParticipant):
            await asyncio.sleep(1)  # Give time for tracks to be published
            if not teacher_track:
                find_and_transcribe_teacher()

        # Event handler for track subscription
        @ctx.room.on("track_subscribed")
        def on_track_subscribed(
            track: rtc.Track,
            publication: rtc.TrackPublication,
            participant: rtc.RemoteParticipant,
        ):
            nonlocal teacher_track
            if not teacher_track and is_teacher(participant) and track.kind == rtc.TrackKind.KIND_AUDIO:
                logger.info(f"Teacher track subscribed: {participant.identity}")
                teacher_track = track
                task = asyncio.create_task(transcribe_teacher_track(participant, track))
                active_tasks.append(task)
                task.add_done_callback(lambda t: active_tasks.remove(t) if t in active_tasks else None)

        # Event handler for participant disconnection
        @ctx.room.on("participant_disconnected")
        def on_participant_disconnected(participant: rtc.RemoteParticipant):
            logger.info(f"Participant disconnected: {participant.identity}")
            if is_teacher(participant) and transcriber:
                # Stop transcription if teacher disconnects
                asyncio.create_task(transcriber.stop())

        # Connect to the room
        await ctx.connect(auto_subscribe=rtc.TrackSubscribeOption.SUBSCRIBE_ALL)
        logger.info("Translation agent connected to room: %s", ctx.room.name)

        # Set up RPC for the client to fetch available languages
        @ctx.room.local_participant.register_rpc_method("get/languages")
        async def get_languages(data: rtc.RpcInvocationData):
            logger.info("Received RPC request for languages")
            return json.dumps([asdict(lang) for lang in SUPPORTED_LANGUAGES.values()])

        # Set up RPC for performance metrics
        @ctx.room.local_participant.register_rpc_method("get/metrics")
        async def get_metrics(data: rtc.RpcInvocationData):
            logger.info("Received RPC request for metrics")
            return json.dumps(performance_monitor.get_metrics())

        # Event handler for participant attribute changes
        @ctx.room.on("participant_attributes_changed")
        def on_attributes_changed(changed_attributes: dict[str, str], participant: rtc.Participant):
            # Handle student language selection for translation
            lang_code = changed_attributes.get("captions_language")
            if lang_code and lang_code in SUPPORTED_LANGUAGES and lang_code not in translators:
                target_language = SUPPORTED_LANGUAGES[lang_code]
                translators[lang_code] = Translator(ctx.room, target_language, performance_monitor)
                logger.info(f"Added translator for language: {target_language.name}")

            # Handle teacher language change for transcription
            speaking_lang = changed_attributes.get("speaking_language")
            if speaking_lang and is_teacher(participant):
                logger.info(f"Teacher changed speaking language to: {speaking_lang}")
                # Note: The Realtime API can handle multiple languages automatically

        # Check for existing teacher
        find_and_transcribe_teacher()

        # Keep the agent running
        while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
            await asyncio.sleep(1)

    except Exception as e:
        logger.error(f"Critical error in agent entrypoint: {e}", exc_info=True)
        raise
    finally:
        # Clean up
        metrics_task.cancel()

        # Stop transcriber if running
        if transcriber:
            await transcriber.stop()

        # Cancel all active tasks
        for task in active_tasks:
            task.cancel()

        # Log final metrics
        performance_monitor.log_metrics()
        logger.info("Translation agent shutting down")

# Request handler to accept jobs for any room
async def request_fnc(req: JobRequest):
    logger.info("Accepting job for room %s", req.room.name)
    await req.accept(
        name="agent",
        identity="agent",
    )

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, request_fnc=request_fnc))