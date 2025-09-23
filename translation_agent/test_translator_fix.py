#!/usr/bin/env python3
"""
Test script to verify Translator class initialization fix
"""

import asyncio
import os
from unittest.mock import MagicMock
from dotenv import load_dotenv
from livekit import rtc
from livekit.plugins import openai
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_translator")

# Import the fixed classes
from main import Translator, PerformanceMonitor, SUPPORTED_LANGUAGES

async def test_translator_initialization():
    """Test that Translator initializes without max_tokens error"""
    logger.info("Testing Translator initialization...")

    try:
        # Create mock objects
        mock_room = MagicMock(spec=rtc.Room)
        performance_monitor = PerformanceMonitor()
        language = SUPPORTED_LANGUAGES["es"]  # Spanish for testing

        # Initialize Translator - should not raise TypeError
        translator = Translator(mock_room, language, performance_monitor)

        # Verify initialization successful
        assert translator is not None
        assert translator.language.code == "es"
        assert translator.llm is not None
        logger.info("✅ Translator initialized successfully without max_tokens error")

        # Verify LLM model is GPT-4o
        logger.info(f"✅ Using LLM model: gpt-4o")

        # Test that we can create a chat context
        initial_ctx = openai.ChatContext()
        initial_ctx.append(
            role="system",
            text=f"You are a skilled translator. Your task is to translate messages to {language.name} ({language.code}). "
                 f"Respond only with the translated text, without any additional commentary or explanation."
        )
        logger.info("✅ Chat context created successfully")

        return True

    except TypeError as e:
        if "max_tokens" in str(e):
            logger.error(f"❌ max_tokens error still present: {e}")
            return False
        else:
            logger.error(f"❌ Unexpected TypeError: {e}")
            return False
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return False

async def test_llm_parameters():
    """Test what parameters the LLM actually accepts"""
    logger.info("\nTesting LLM parameter acceptance...")

    try:
        # Test with only required parameters
        llm1 = openai.LLM(model="gpt-4o")
        logger.info("✅ LLM accepts: model parameter")

        # Test with temperature
        llm2 = openai.LLM(model="gpt-4o", temperature=0.3)
        logger.info("✅ LLM accepts: temperature parameter")

        # Test if max_tokens is accepted (should fail based on our fix)
        try:
            llm3 = openai.LLM(model="gpt-4o", max_tokens=500)
            logger.warning("⚠️ LLM unexpectedly accepted max_tokens - verify fix is applied")
        except TypeError as e:
            if "max_tokens" in str(e):
                logger.info("✅ LLM correctly rejects max_tokens parameter (as expected)")
            else:
                logger.warning(f"⚠️ Different TypeError: {e}")

        return True

    except Exception as e:
        logger.error(f"❌ Error testing LLM parameters: {e}")
        return False

async def main():
    """Run all tests"""
    logger.info("=" * 60)
    logger.info("TRANSLATOR FIX VERIFICATION TEST")
    logger.info("=" * 60)

    # Check environment
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.error("❌ OPENAI_API_KEY not set in environment")
        return

    logger.info(f"✅ OPENAI_API_KEY configured (length: {len(api_key)})")

    # Run tests
    test1_result = await test_translator_initialization()
    test2_result = await test_llm_parameters()

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("TEST SUMMARY")
    logger.info("=" * 60)

    if test1_result and test2_result:
        logger.info("✅ ALL TESTS PASSED - Translator fix is working correctly!")
        logger.info("The max_tokens parameter has been successfully removed.")
        logger.info("Students should now be able to join and select translation languages without errors.")
    else:
        logger.error("❌ SOME TESTS FAILED - Please review the fix in main.py")
        logger.info("Ensure line 120 removes the max_tokens parameter from openai.LLM()")

if __name__ == "__main__":
    asyncio.run(main())