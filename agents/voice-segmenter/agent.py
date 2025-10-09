import asyncio
import logging
import json
from typing import Dict, Any

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    JobRequest,
    WorkerOptions,
    cli,
)
from livekit.plugins import silero

from config import config
from audio_processor import AudioProcessor
from translator import GeminiTranslator

# Setup logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('voice-segmenter')


def prewarm(proc: JobProcess):
    """Prewarm function - runs once when worker starts"""
    logger.info('🔥 Prewarming agent...')

    # Validate configuration
    errors = config.validate()
    if errors:
        logger.error(f'❌ Configuration errors: {errors}')
        raise ValueError(f'Configuration invalid: {errors}')

    config.print_config()
    logger.info('✅ Configuration validated')

    # Load Silero VAD model
    logger.info('🧠 Loading Silero VAD model...')
    try:
        vad = silero.VAD.load()
        proc.userdata['vad'] = vad
        logger.info('✅ Silero VAD model loaded successfully')
    except Exception as e:
        logger.error(f'❌ Failed to load Silero VAD: {e}')
        raise

    # Initialize Gemini translator (if API key available)
    translator = None
    if config.GEMINI_API_KEY:
        try:
            translator = GeminiTranslator(config.GEMINI_API_KEY)
            proc.userdata['translator'] = translator
            logger.info('✅ Gemini translator initialized')
        except Exception as e:
            logger.warning(f'⚠️ Failed to initialize translator: {e}')
            logger.warning('⚠️ Agent will run without translation')
    else:
        logger.warning('⚠️ No GEMINI_API_KEY - translation disabled')

    # Initialize audio processor (in-memory mode)
    # Note: room will be set in entrypoint
    proc.userdata['audio_processor_config'] = {
        'vad': vad,
        'translator': translator
    }
    logger.info('✅ Audio processor config prepared')

    logger.info('✅ Agent prewarmed successfully')


async def entrypoint(ctx: JobContext):
    """Main entrypoint - runs for each room the agent joins"""
    logger.info(f'🚀 Agent starting for room: {ctx.room.name}')

    # Connect to room
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info(f'✅ Connected to room: {ctx.room.name}')
    logger.info(f'🤖 Agent identity: {config.AGENT_IDENTITY}')

    # Log room state
    logger.info(f'📊 Room participants: {len(ctx.room.remote_participants)}')
    for participant in ctx.room.remote_participants.values():
        logger.info(f'  👤 {participant.identity} - {participant.name}')

    # Event: Participant connected
    @ctx.room.on('participant_connected')
    def on_participant_connected(participant: rtc.RemoteParticipant):
        logger.info(f'👤 Participant connected: {participant.identity}')

        # Check if teacher
        metadata = get_participant_metadata(participant)
        role = metadata.get('role', 'unknown')
        logger.info(f'  Role: {role}')

    # Event: Participant disconnected
    @ctx.room.on('participant_disconnected')
    def on_participant_disconnected(participant: rtc.RemoteParticipant):
        logger.info(f'👋 Participant disconnected: {participant.identity}')

    # Create audio processor for this room
    processor_config = ctx.proc.userdata['audio_processor_config']
    audio_processor = AudioProcessor(
        vad_model=processor_config['vad'],
        translator=processor_config['translator'],
        room=ctx.room
    )

    # Event: Track subscribed
    @ctx.room.on('track_subscribed')
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant
    ):
        logger.info(f'🎵 Track subscribed: {track.kind} from {participant.identity}')

        # Only process audio tracks
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            logger.debug(f'⏭️ Skipping non-audio track: {track.kind}')
            return

        # Check if teacher
        if not is_teacher(participant):
            logger.debug(f'⏭️ Skipping non-teacher audio: {participant.identity}')
            return

        logger.info(f'🎤 Teacher audio track detected: {participant.identity}')

        # Process teacher audio with VAD
        asyncio.create_task(
            audio_processor.process_track(track, participant, ctx.room.name)
        )

        logger.info(f'✅ Audio processing started for: {participant.identity}')

    # Event: Participant attribute changes (for language selection)
    @ctx.room.on('participant_attributes_changed')
    def on_attributes_changed(
        changed_attributes: dict,
        participant: rtc.RemoteParticipant
    ):
        logger.info(f'🔄 Attributes changed: {participant.identity}', extra={
            'changes': changed_attributes
        })

        # Handle speaking_language (teacher)
        if 'speaking_language' in changed_attributes:
            speaking_lang = changed_attributes['speaking_language']
            logger.info(f'🎤 Teacher language: {speaking_lang}')

            # Set the source language for transcription
            audio_processor.set_source_language(speaking_lang)
            logger.info(f'✅ Updated source language for transcription')

        # Handle captions_language (student)
        if 'captions_language' in changed_attributes:
            captions_lang = changed_attributes['captions_language']
            logger.info(f'📝 Student requested language: {captions_lang}')

            # Add language to active translations
            audio_processor.add_language(captions_lang)
            logger.info(f'✅ Active languages: {audio_processor.get_active_languages()}')

    logger.info('🎯 Agent ready and listening')
    logger.info('📡 Waiting for teacher to join and speak...')


def is_teacher(participant: rtc.RemoteParticipant) -> bool:
    """Check if participant is a teacher"""

    # Method 1: Check metadata
    metadata = get_participant_metadata(participant)
    if metadata.get('role') == 'teacher':
        return True

    # Method 2: Check attributes (for speaking_language)
    if participant.attributes.get('speaking_language'):
        return True

    # Method 3: Check name (fallback)
    name = participant.name.lower() if participant.name else ''
    if 'teacher' in name or 'speaker' in name:
        return True

    return False


def get_participant_metadata(participant: rtc.RemoteParticipant) -> Dict[str, Any]:
    """Extract metadata from participant"""
    try:
        if participant.metadata:
            return json.loads(participant.metadata)
    except Exception as e:
        logger.debug(f'Could not parse participant metadata: {e}')

    return {}


async def request_fnc(req: JobRequest):
    """Handle job requests - decides whether to accept room"""
    logger.info(f'🎯 Job request received for room: {req.room.name}')

    # Accept all rooms (or add filtering logic here)
    await req.accept(
        name=config.AGENT_NAME,
        identity=config.AGENT_IDENTITY
    )

    logger.info(f'✅ Accepted job request for room: {req.room.name}')


if __name__ == '__main__':
    logger.info('🚀 Starting Voice Segmenter Agent')

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            request_fnc=request_fnc
        )
    )
