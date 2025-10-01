import asyncio
import json
import logging
import os
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
    stt,
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
    "cmn": Language(code="cmn", name="Chinese", flag="🇨🇳"),
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
        # Note: max_tokens is not supported by LiveKit OpenAI plugin - it handles token limits internally
        self.llm = openai.LLM(
            model="gpt-4o",
            temperature=0.3,  # Lower temperature for more consistent translations
        )

        # Store the system prompt for reuse (optimization)
        # We don't need to maintain a persistent ChatContext anymore
        # Each translation will get a fresh context to prevent quality degradation
        self.system_prompt = (
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
                # Create fresh ChatContext for each translation to avoid context pollution
                # This prevents quality degradation over time
                temp_ctx = llm.ChatContext()

                # Add the stored system prompt (optimization: reuse instead of recreating)
                temp_ctx.add_message(role="system", content=self.system_prompt)

                # Add only the current message to translate
                temp_ctx.add_message(role="user", content=message)

                # Get the translation using the fresh context
                stream = self.llm.chat(chat_ctx=temp_ctx)
                translated_message = ""

                # LiveKit OpenAI plugin uses direct chunk.delta structure, not chunk.choices
                # This is different from the standard OpenAI API structure
                async for chunk in stream:
                    if chunk.delta and chunk.delta.content:
                        translated_message += chunk.delta.content

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

# Configuration constants for easy tuning
# Note: Only parameters that work with standard HTTP streaming transcription
TRANSCRIPTION_CONFIG = {
    # Prompt context for better recognition
    "prompt": "Educational content with technical vocabulary. Focus on accuracy and complete sentences.",
}

# Alternative configurations for different scenarios
QUALITY_FOCUSED_CONFIG = {
    "prompt": "Academic lecture with technical terms. Prioritize accuracy and complete thoughts.",
}

LATENCY_FOCUSED_CONFIG = {
    "prompt": "Real-time conversation. Quick response priority.",
}

# StreamingTranscriber using OpenAI STT with GPT-4o transcribe model
class StreamingTranscriber:
    """Handles real-time transcription using OpenAI's GPT-4o transcribe model with LiveKit streaming

    GPT-4o transcribe offers:
    - Superior accuracy with lower Word Error Rate (WER)
    - Better multilingual support (100+ languages)
    - Improved handling of accents and noisy environments
    - Optimized for real-time streaming use cases
    - Context prompt support for better domain-specific recognition
    """

    def __init__(self, performance_monitor: PerformanceMonitor, model: Optional[str] = None, config: Optional[Dict] = None):
        self.performance_monitor = performance_monitor
        self.active = False

        # Use provided config or default to TRANSCRIPTION_CONFIG
        self.config = config or TRANSCRIPTION_CONFIG

        # Force GPT-4o transcribe model only - no fallback
        self.model_name = "gpt-4o-transcribe"
        logger.info(f"Initializing StreamingTranscriber with model: {self.model_name}")
        if "prompt" in self.config:
            logger.info(f"Configuration: Using context prompt for better recognition")

        try:
            # Build STT configuration - only use parameters that work with standard transcription
            stt_config = {
                "model": self.model_name,
                "language": "en",  # Default to English, can be overridden in stream
            }

            # Add prompt if configured (may help with context)
            if "prompt" in self.config:
                stt_config["prompt"] = self.config.get("prompt", "Educational content with technical vocabulary.")
                logger.info(f"Using prompt for context: {stt_config['prompt'][:50]}...")

            # Initialize OpenAI STT with compatible configuration only
            self.stt = openai.STT(**stt_config)
            logger.info(f"Successfully initialized STT with {self.model_name} model")
        except Exception as e:
            logger.error(f"Failed to initialize {self.model_name} model: {e}")
            logger.error("GPT-4o transcribe model is required. Please ensure your OpenAI API key has access to this model.")
            # Re-raise the exception - no fallback allowed
            raise RuntimeError(f"Failed to initialize GPT-4o transcribe model: {e}") from e

    async def start(self, track: rtc.Track, on_transcription_callback, language: str = "en"):
        """Start the real-time transcription session with GPT-4o transcribe

        Args:
            track: LiveKit audio track to transcribe
            on_transcription_callback: Callback function for transcribed text
            language: Language code for transcription (default: "en")
        """
        self.active = True
        self.on_transcription = on_transcription_callback
        logger.info(f"Starting transcription session for track: {track.sid} with model: {self.model_name}")

        try:
            # Log the language being used for transcription
            logger.info(f"Using language: {language} with {self.model_name} model")

            # Set up audio stream from LiveKit track
            audio_stream = rtc.AudioStream(track)
            logger.info("Audio stream created from track")

            # Create STT stream with the language
            # GPT-4o transcribe supports automatic language detection if not specified
            stt_stream_config = {}
            if language and language != "auto":
                stt_stream_config["language"] = language
                logger.info(f"STT stream configured for {language} language")
            else:
                logger.info("STT stream configured for automatic language detection")

            stt_stream = self.stt.stream(**stt_stream_config)
            logger.info(f"STT stream created with {self.model_name} model")

            # Set up the forward transcription task
            async def forward_transcription():
                """Forward transcriptions to the callback"""
                logger.info("Starting forward_transcription task")
                async for event in stt_stream:
                    try:
                        if event.type == stt.SpeechEventType.FINAL_TRANSCRIPT:
                            text = event.alternatives[0].text.strip()
                            if text:
                                start_time = time.time()
                                # Send transcription
                                await on_transcription_callback(text, track)

                                duration = time.time() - start_time
                                self.performance_monitor.record_transcription(duration)
                                self.performance_monitor.record_success()

                                logger.info(f"Transcribed ({self.model_name}): {text[:100]}...")
                    except Exception as e:
                        self.performance_monitor.record_error()
                        logger.error(f"Transcription forward error: {e}")

            # Start forwarding task
            forward_task = asyncio.create_task(forward_transcription())

            # Process audio frames
            frames_processed = 0
            async for audio_event in audio_stream:
                if not self.active:
                    break

                # Push frame to STT stream
                stt_stream.push_frame(audio_event.frame)
                frames_processed += 1
                if frames_processed % 100 == 0:
                    logger.debug(f"Processed {frames_processed} audio frames")

            # Clean up
            forward_task.cancel()
            await stt_stream.aclose()

        except Exception as e:
            logger.error(f"Failed in transcription stream: {e}", exc_info=True)
        finally:
            await self.stop()

    async def stop(self):
        """Stop the transcription session"""
        self.active = False

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
            """Start transcribing the teacher's audio track using GPT-4o transcribe model"""
            nonlocal transcriber

            # Get teacher's speaking language from attributes
            teacher_language = "en"  # Default to English
            if participant.attributes:
                teacher_language = participant.attributes.get("speaking_language", "en")
                logger.info(f"Teacher speaking language: {teacher_language}")

            # Initialize transcriber with GPT-4o transcribe model
            # Model can be overridden via OPENAI_STT_MODEL environment variable
            transcriber = StreamingTranscriber(performance_monitor)
            await transcriber.start(track, handle_transcription, language=teacher_language)

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
        await ctx.connect()
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
                # Note: GPT-4o transcribe model has excellent multilingual support
                # and can automatically detect language changes during transcription

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