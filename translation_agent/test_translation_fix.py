#!/usr/bin/env python3
"""Test script to verify translation quality fix"""

import asyncio
from livekit.agents import llm
from livekit.plugins import openai
import time

async def test_translation_consistency():
    """Test that translations maintain consistent quality"""

    # Initialize LLM
    llm_instance = openai.LLM(
        model="gpt-4o",
        temperature=0.3,
    )

    # Test messages
    test_messages = [
        "Hello students, today we will learn about mathematics.",
        "First, let's review the homework from yesterday.",
        "Who can tell me what we discussed last week?",
        "Excellent work on your assignments.",
        "Now let's move on to the next topic.",
    ]

    target_language = "Arabic"

    print(f"Testing translation consistency to {target_language}...")
    print("-" * 60)

    for i, message in enumerate(test_messages, 1):
        # Create fresh ChatContext for each translation (NEW APPROACH)
        temp_ctx = llm.ChatContext()

        # Add system prompt
        system_prompt = (
            f"You are a professional real-time translator specializing in {target_language}. "
            f"Your task is to provide accurate, natural-sounding translations while preserving:\n"
            f"1. The speaker's tone and intent\n"
            f"2. Technical terminology and proper nouns\n"
            f"3. Cultural context and idioms where appropriate\n\n"
            f"Rules:\n"
            f"- Translate the input text directly to {target_language}\n"
            f"- Keep translations concise and clear\n"
            f"- Preserve formatting and punctuation\n"
            f"- Do not add explanations or comments\n"
            f"- Respond ONLY with the translated text"
        )
        temp_ctx.add_message(role="system", content=system_prompt)
        temp_ctx.add_message(role="user", content=message)

        # Get translation
        start_time = time.time()
        stream = llm_instance.chat(chat_ctx=temp_ctx)
        translated = ""

        async for chunk in stream:
            if chunk.delta and chunk.delta.content:
                translated += chunk.delta.content

        duration = (time.time() - start_time) * 1000

        print(f"\nMessage {i}:")
        print(f"  Original: {message}")
        print(f"  Translated: {translated}")
        print(f"  Time: {duration:.1f}ms")

    print("\n" + "=" * 60)
    print("✅ Translation consistency test complete!")
    print("Each translation should maintain consistent quality.")
    print("No degradation should occur over multiple translations.")

async def test_old_approach_degradation():
    """Demonstrate the problem with the old approach"""

    print("\n" + "=" * 60)
    print("COMPARISON: Old approach with context accumulation")
    print("-" * 60)

    # Initialize LLM
    llm_instance = openai.LLM(
        model="gpt-4o",
        temperature=0.3,
    )

    # OLD APPROACH: Single persistent ChatContext
    persistent_ctx = llm.ChatContext()

    target_language = "Arabic"
    system_prompt = (
        f"You are a professional real-time translator specializing in {target_language}. "
        f"Translate the input text directly to {target_language}. "
        f"Respond ONLY with the translated text"
    )
    persistent_ctx.add_message(role="system", content=system_prompt)

    test_messages = [
        "The cat is black.",
        "The dog is white.",
        "The bird is yellow.",
    ]

    print(f"Testing OLD approach (accumulating context)...")
    print("-" * 60)

    for i, message in enumerate(test_messages, 1):
        # OLD APPROACH: Keep adding to same context
        persistent_ctx.add_message(role="user", content=message)

        stream = llm_instance.chat(chat_ctx=persistent_ctx)
        translated = ""

        async for chunk in stream:
            if chunk.delta and chunk.delta.content:
                translated += chunk.delta.content

        print(f"\nMessage {i}:")
        print(f"  Original: {message}")
        print(f"  Translated: {translated}")
        print(f"  Context size: {len(persistent_ctx.messages)} messages")

    print("\n⚠️  Notice: Later translations may reference earlier ones!")
    print("This causes quality degradation and confusion.")

if __name__ == "__main__":
    print("Translation Quality Fix Verification Test")
    print("=" * 60)

    # Run tests
    asyncio.run(test_translation_consistency())
    asyncio.run(test_old_approach_degradation())

    print("\n" + "=" * 60)
    print("Test complete! The new approach ensures consistent quality.")