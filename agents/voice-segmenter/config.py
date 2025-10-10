import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set GOOGLE_APPLICATION_CREDENTIALS if specified in .env
if os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
    credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    # Make path absolute if relative
    if not os.path.isabs(credentials_path):
        credentials_path = os.path.join(os.path.dirname(__file__), credentials_path)
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path

class Config:
    """Agent configuration from environment variables"""

    # LiveKit
    LIVEKIT_URL = os.getenv('LIVEKIT_URL', '')
    LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY', '')
    LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET', '')

    # Vertex AI Configuration (NEW)
    GOOGLE_CLOUD_PROJECT = os.getenv('GOOGLE_CLOUD_PROJECT', '')
    GOOGLE_CLOUD_LOCATION = os.getenv('GOOGLE_CLOUD_LOCATION', 'us-central1')

    # Legacy config (deprecated, for backwards compatibility)
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

        # Validate Vertex AI config (optional but recommended)
        if not cls.GOOGLE_CLOUD_PROJECT:
            errors.append('GOOGLE_CLOUD_PROJECT not set (translation will be disabled)')

        return errors

    @classmethod
    def print_config(cls):
        """Print configuration for debugging"""
        print('🔧 Agent Configuration:')
        print(f'  LiveKit URL: {cls.LIVEKIT_URL[:30]}...' if cls.LIVEKIT_URL else '  LiveKit URL: NOT SET')
        print(f'  API Key: {cls.LIVEKIT_API_KEY[:10]}...' if cls.LIVEKIT_API_KEY else '  API Key: NOT SET')
        print(f'  GCP Project: {cls.GOOGLE_CLOUD_PROJECT}' if cls.GOOGLE_CLOUD_PROJECT else '  GCP Project: NOT SET')
        print(f'  GCP Location: {cls.GOOGLE_CLOUD_LOCATION}')
        print(f'  Agent Identity: {cls.AGENT_IDENTITY}')
        print(f'  Output Directory: {cls.OUTPUT_DIR}')
        print(f'  Save Audio: {cls.SAVE_AUDIO}')
        print(f'  Save Translations: {cls.SAVE_TRANSLATIONS}')
        print(f'  Log Level: {cls.LOG_LEVEL}')

config = Config()
