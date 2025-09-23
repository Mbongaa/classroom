#!/usr/bin/env python3
"""Test script to verify enhanced transcription configuration"""

import asyncio
import logging
from livekit.plugins import openai
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_enhanced_transcription():
    """Test the enhanced transcription configuration"""

    print("=" * 60)
    print("Testing Enhanced Transcription Configuration")
    print("=" * 60)

    # Configuration to test - only compatible parameters
    config = {
        "model": "gpt-4o-transcribe",
        "language": "en",
        "prompt": "Educational content with technical vocabulary. Focus on accuracy and complete sentences.",
    }

    print("\n📋 Configuration Details:")
    print(f"  Model: {config['model']}")
    print(f"  Language: {config['language']}")
    print(f"  Prompt: {config['prompt'][:50]}...")

    try:
        # Test initialization
        print("\n🔧 Initializing STT with enhanced configuration...")
        stt = openai.STT(**config)
        print("✅ STT initialized successfully!")

        print("\n🎯 Working Configuration:")
        print("  ✅ GPT-4o transcribe model")
        print("  ✅ Language specification for accuracy")
        print("  ✅ Context prompt for better recognition")

        print("\n📊 Expected Results:")
        print("  - Better handling of technical vocabulary (from prompt)")
        print("  - Improved transcription accuracy")
        print("  - Standard streaming transcription")

        print("\n💡 Configuration Options Available:")
        print("  1. TRANSCRIPTION_CONFIG (default - educational content)")
        print("  2. QUALITY_FOCUSED_CONFIG (academic lectures)")
        print("  3. LATENCY_FOCUSED_CONFIG (real-time conversation)")

    except Exception as e:
        print(f"\n❌ Error during initialization: {e}")
        print("\n⚠️ Troubleshooting:")
        print("  1. Ensure OPENAI_API_KEY is set in environment")
        print("  2. Verify API key has access to gpt-4o-transcribe model")
        print("  3. Check if livekit-plugins-openai is properly installed")
        return False

    print("\n" + "=" * 60)
    print("✅ Configuration test completed successfully!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    # Run the test
    success = asyncio.run(test_enhanced_transcription())

    if success:
        print("\n🚀 Ready to use enhanced transcription!")
        print("Start the translation agent with: python main.py dev")
    else:
        print("\n❌ Please fix the issues before running the translation agent")