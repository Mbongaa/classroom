import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Agent configuration from environment variables"""

    # LiveKit
    LIVEKIT_URL = os.getenv('LIVEKIT_URL', '')
    LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY', '')
    LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET', '')

    # Gemini
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

    # Output
    OUTPUT_DIR = os.getenv('OUTPUT_DIR', 'segments')
    SAVE_AUDIO = os.getenv('SAVE_AUDIO', 'true').lower() == 'true'
    SAVE_TRANSLATIONS = os.getenv('SAVE_TRANSLATIONS', 'false').lower() == 'true'

    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

    # Agent
    AGENT_IDENTITY = 'voice-segmenter'
    AGENT_NAME = 'Voice Segmenter Agent'

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        errors = []

        if not cls.LIVEKIT_URL:
            errors.append('LIVEKIT_URL not set')
        if not cls.LIVEKIT_API_KEY:
            errors.append('LIVEKIT_API_KEY not set')
        if not cls.LIVEKIT_API_SECRET:
            errors.append('LIVEKIT_API_SECRET not set')

        return errors

    @classmethod
    def print_config(cls):
        """Print configuration for debugging"""
        print('🔧 Agent Configuration:')
        print(f'  LiveKit URL: {cls.LIVEKIT_URL[:30]}...' if cls.LIVEKIT_URL else '  LiveKit URL: NOT SET')
        print(f'  API Key: {cls.LIVEKIT_API_KEY[:10]}...' if cls.LIVEKIT_API_KEY else '  API Key: NOT SET')
        print(f'  Gemini API Key: {cls.GEMINI_API_KEY[:10]}...' if cls.GEMINI_API_KEY else '  Gemini API Key: NOT SET')
        print(f'  Agent Identity: {cls.AGENT_IDENTITY}')
        print(f'  Output Directory: {cls.OUTPUT_DIR}')
        print(f'  Save Audio: {cls.SAVE_AUDIO}')
        print(f'  Save Translations: {cls.SAVE_TRANSLATIONS}')
        print(f'  Log Level: {cls.LOG_LEVEL}')

config = Config()
