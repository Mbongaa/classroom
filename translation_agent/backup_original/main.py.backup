import asyncio
import json
import logging
from dataclasses import dataclass, asdict

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
from livekit.plugins import openai, silero

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger("translation-agent")

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
}

# The main Translator class that handles translation for a specific language
class Translator:
    def __init__(self, room: rtc.Room, language: Language):
        self.room = room
        self.language = language
        self.llm = openai.LLM()
        # Create ChatContext using the correct API - use add_message not append
        self.chat_ctx = llm.ChatContext()
        self.chat_ctx.add_message(
            role="system",
            content=(
                f"You are a translator for language: {language.name}. "
                f"Your only response should be the exact translation of input text in the {language.name} language."
            ),
        )

    async def translate(self, message: str, track_sid: str):
        # Add the user's message to the chat context
        self.chat_ctx.add_message(role="user", content=message)

        # Get the translation from the LLM
        stream = self.llm.chat(chat_ctx=self.chat_ctx)
        translated_message = ""

        async for chunk in stream:
            # Access content directly from chunk.delta (ChatChunk structure)
            if chunk.delta and chunk.delta.content:
                translated_message += chunk.delta.content

        # Create and publish the transcription segment
        segment = rtc.TranscriptionSegment(
            id=utils.misc.shortuuid("SG_"),
            text=translated_message,
            language=self.language.code,  # Use language code for client-side filtering
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
        logger.info(f"Translated to {self.language.name}: {translated_message}")

# Main entrypoint for the agent
async def entrypoint(ctx: JobContext):
    # Initialize STT and translator dictionary
    stt_provider = openai.STT()
    translators: dict[str, Translator] = {}
    active_tasks = []
    teacher_track = None

    # Function to forward transcriptions to the appropriate translators
    async def forward_transcription(stt_stream: stt.SpeechStream, track: rtc.Track):
        async for ev in stt_stream:
            if ev.type == stt.SpeechEventType.FINAL_TRANSCRIPT:
                message = ev.alternatives[0].text
                logger.info(f"Transcribed from teacher: {message}")

                # Send to all active translators
                for translator in translators.values():
                    # Create a new task for each translation to run them in parallel
                    task = asyncio.create_task(translator.translate(message, track.sid))
                    active_tasks.append(task)
                    task.add_done_callback(active_tasks.remove)

    # Function to start transcribing a teacher's track
    async def transcribe_teacher_track(participant: rtc.Participant, track: rtc.Track):
        # Get teacher's speaking language from attributes
        teacher_language = "en"  # Default to English
        if participant.attributes:
            teacher_language = participant.attributes.get("speaking_language", "en")
            logger.info(f"Teacher speaking language: {teacher_language}")

        audio_stream = rtc.AudioStream(track)
        # Configure STT with teacher's language for better accuracy
        stt_stream = stt_provider.stream(language=teacher_language)
        task = asyncio.create_task(forward_transcription(stt_stream, track))
        active_tasks.append(task)
        task.add_done_callback(active_tasks.remove)

        async for ev in audio_stream:
            stt_stream.push_frame(ev.frame)

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
                        task.add_done_callback(active_tasks.remove)
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
            task.add_done_callback(active_tasks.remove)

    # Connect to the room first
    await ctx.connect()
    logger.info("Translation agent connected to room: %s", ctx.room.name)

    # Set up RPC for the client to fetch available languages (AFTER connection)
    @ctx.room.local_participant.register_rpc_method("get/languages")
    async def get_languages(data: rtc.RpcInvocationData):
        logger.info("Received RPC request for languages")
        return json.dumps([asdict(lang) for lang in SUPPORTED_LANGUAGES.values()])

    # Event handler for participant attribute changes (e.g., language selection)
    @ctx.room.on("participant_attributes_changed")
    def on_attributes_changed(changed_attributes: dict[str, str], participant: rtc.Participant):
        # Handle student language selection for translation
        lang_code = changed_attributes.get("captions_language")
        if lang_code and lang_code in SUPPORTED_LANGUAGES and lang_code not in translators:
            target_language = SUPPORTED_LANGUAGES[lang_code]
            translators[lang_code] = Translator(ctx.room, target_language)
            logger.info(f"Added translator for language: {target_language.name}")

        # Handle teacher language change for transcription
        speaking_lang = changed_attributes.get("speaking_language")
        if speaking_lang and is_teacher(participant):
            logger.info(f"Teacher changed speaking language to: {speaking_lang}")
            # Note: The new language will be used when the teacher reconnects audio
            # or we could restart the transcription stream here if needed

    # Check for existing teacher
    find_and_transcribe_teacher()


# Request handler to accept jobs for any room
async def request_fnc(req: JobRequest):
    logger.info("Accepting job for room %s", req.room.name)
    await req.accept(
        name="agent",
        identity="agent",
    )

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, request_fnc=request_fnc))