#!/usr/bin/env python3
"""Test script to verify ChatContext API usage is correct"""

import sys
try:
    from livekit.agents import llm
    from livekit.plugins import openai

    print("✅ Imports successful")

    # Test creating ChatContext
    try:
        chat_ctx = llm.ChatContext()
        print("✅ ChatContext created successfully")

        # Test adding messages to ChatContext
        chat_ctx.add_message(
            role="system",
            content="You are a test translator"
        )
        print("✅ ChatContext.add_message() works")

        # Test creating LLM instance
        test_llm = openai.LLM()
        print("✅ OpenAI LLM instance created")

        print("\n🎉 All tests passed! The ChatContext API using add_message() is correct.")

    except AttributeError as e:
        print(f"❌ Error with ChatContext: {e}")
        sys.exit(1)

except ImportError as e:
    print(f"⚠️ Import error: {e}")
    print("Please ensure you have installed the requirements:")
    print("  pip install livekit-agents livekit-plugins-openai")
    sys.exit(1)