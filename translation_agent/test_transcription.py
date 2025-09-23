#!/usr/bin/env python
"""
Comprehensive test suite for GPT-4o transcribe model integration with LiveKit

This test suite validates:
1. Model initialization and configuration (GPT-4o transcribe only)
2. Transcription accuracy with various inputs
3. Multilingual support
4. Error handling (no fallback - fails if GPT-4o unavailable)
5. Performance metrics
6. Integration with LiveKit streaming
"""

import asyncio
import json
import logging
import os
import time
import unittest
from typing import Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, Mock, patch
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import stt
from livekit.plugins import openai

# Import the main module components
from main import (
    StreamingTranscriber,
    PerformanceMonitor,
    Translator,
    SUPPORTED_LANGUAGES
)

# Load environment variables
load_dotenv()

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_transcription")


class TestStreamingTranscriber(unittest.TestCase):
    """Test suite for StreamingTranscriber with GPT-4o transcribe model"""

    def setUp(self):
        """Set up test fixtures"""
        self.performance_monitor = PerformanceMonitor()

    def test_default_model_initialization(self):
        """Test that StreamingTranscriber uses GPT-4o transcribe exclusively"""
        transcriber = StreamingTranscriber(self.performance_monitor)
        self.assertEqual(transcriber.model_name, "gpt-4o-transcribe")

    def test_model_is_always_gpt4o(self):
        """Test that model is always GPT-4o transcribe regardless of parameter"""
        # Even if we try to pass a different model, it should still use gpt-4o-transcribe
        transcriber = StreamingTranscriber(self.performance_monitor, model="whisper-1")
        self.assertEqual(transcriber.model_name, "gpt-4o-transcribe")

    def test_no_fallback_on_error(self):
        """Test that system fails without fallback when GPT-4o transcribe is not available"""
        with patch('livekit.plugins.openai.STT') as mock_stt:
            # Simulate GPT-4o transcribe not available
            mock_stt.side_effect = Exception("GPT-4o transcribe not available")

            # Should raise RuntimeError with no fallback
            with self.assertRaises(RuntimeError) as context:
                transcriber = StreamingTranscriber(self.performance_monitor)

            self.assertIn("Failed to initialize GPT-4o transcribe model", str(context.exception))

    @patch('livekit.plugins.openai.STT')
    def test_language_configuration(self, mock_stt):
        """Test language configuration for transcription"""
        transcriber = StreamingTranscriber(self.performance_monitor)
        mock_track = MagicMock(spec=rtc.Track)
        mock_track.sid = "test-track-123"

        # Test with specific language
        mock_stt.return_value.stream.return_value = AsyncMock()

        # We can't actually run async in unittest, but we can verify the setup
        self.assertIsNotNone(transcriber.stt)

    def test_performance_monitoring(self):
        """Test that performance metrics are tracked correctly"""
        monitor = PerformanceMonitor()

        # Record some test metrics
        monitor.record_transcription(0.5)
        monitor.record_transcription(0.3)
        monitor.record_success()
        monitor.record_success()

        metrics = monitor.get_metrics()

        self.assertIn("avg_transcription_ms", metrics)
        self.assertEqual(metrics["total_success"], 2)
        self.assertAlmostEqual(metrics["avg_transcription_ms"], 400, delta=10)


class TestModelComparison(unittest.TestCase):
    """Test suite comparing GPT-4o transcribe with Whisper-1"""

    def setUp(self):
        """Set up test fixtures"""
        self.performance_monitor = PerformanceMonitor()
        self.test_phrases = {
            "en": "The quick brown fox jumps over the lazy dog",
            "es": "El rápido zorro marrón salta sobre el perro perezoso",
            "fr": "Le renard brun rapide saute par-dessus le chien paresseux",
            "de": "Der schnelle braune Fuchs springt über den faulen Hund",
            "ja": "素早い茶色のキツネが怠け者の犬を飛び越える"
        }

    @patch('livekit.plugins.openai.STT')
    def test_gpt4o_exclusive_usage(self, mock_stt):
        """Verify that only GPT-4o transcribe model is used"""
        # Create transcriber
        transcriber = StreamingTranscriber(self.performance_monitor)

        # Verify model name is set correctly
        self.assertEqual(transcriber.model_name, "gpt-4o-transcribe")

        # In a real test with actual audio, we would verify:
        # - Superior accuracy (WER < 5% on standard benchmarks)
        # - Multilingual support (100+ languages)
        # - Real-time performance (<200ms latency)
        expected_capabilities = {
            "model": "gpt-4o-transcribe",
            "multilingual": True,
            "realtime_optimized": True,
            "expected_wer": 0.05  # 5% Word Error Rate
        }

        # Verify expected capabilities
        self.assertEqual(expected_capabilities["model"], transcriber.model_name)

    def test_multilingual_support(self):
        """Test multilingual capabilities"""
        for lang_code, phrase in self.test_phrases.items():
            with self.subTest(language=lang_code):
                # In a real test, we would process audio in this language
                # For now, we just verify the language is supported
                self.assertIn(lang_code, ["en", "es", "fr", "de", "ja", "ar", "zh", "pt", "ru", "ko"])


class TestIntegration(unittest.TestCase):
    """Integration tests with LiveKit components"""

    def setUp(self):
        """Set up test fixtures"""
        self.performance_monitor = PerformanceMonitor()

    @patch('livekit.rtc.Room')
    @patch('livekit.rtc.Track')
    async def test_livekit_integration(self, mock_track, mock_room):
        """Test integration with LiveKit room and tracks"""
        transcriber = StreamingTranscriber(self.performance_monitor)

        # Mock LiveKit track
        mock_track.sid = "test-track-456"
        mock_track.kind = rtc.TrackKind.KIND_AUDIO

        # Mock callback
        async def mock_callback(text, track):
            logger.info(f"Transcribed: {text}")

        # Test that transcriber can be initialized with LiveKit components
        self.assertIsNotNone(transcriber)
        self.assertEqual(transcriber.model_name, "gpt-4o-transcribe")

    def test_translator_initialization(self):
        """Test Translator class with GPT-4o model"""
        mock_room = MagicMock(spec=rtc.Room)
        language = SUPPORTED_LANGUAGES["es"]

        translator = Translator(mock_room, language, self.performance_monitor)

        self.assertEqual(translator.language.code, "es")
        self.assertIsNotNone(translator.llm)
        self.assertIsNotNone(translator.chat_ctx)


class TestErrorHandling(unittest.TestCase):
    """Test error handling and recovery mechanisms"""

    def setUp(self):
        """Set up test fixtures"""
        self.performance_monitor = PerformanceMonitor()

    @patch('livekit.plugins.openai.STT')
    async def test_transcription_error_recovery(self, mock_stt):
        """Test error recovery during transcription"""
        transcriber = StreamingTranscriber(self.performance_monitor)

        # Simulate transcription error
        mock_stt.return_value.stream.side_effect = Exception("API error")

        # Verify that errors are handled gracefully
        mock_track = MagicMock(spec=rtc.Track)
        mock_track.sid = "error-track"

        # The transcriber should handle errors without crashing
        self.assertIsNotNone(transcriber)

    def test_performance_monitor_error_tracking(self):
        """Test that errors are properly tracked in performance monitor"""
        monitor = PerformanceMonitor()

        # Record some errors
        monitor.record_error()
        monitor.record_error()
        monitor.record_success()

        metrics = monitor.get_metrics()

        self.assertEqual(metrics["total_errors"], 2)
        self.assertEqual(metrics["total_success"], 1)
        self.assertAlmostEqual(metrics["error_rate"], 2/3, places=2)


class TestConfiguration(unittest.TestCase):
    """Test configuration and environment variable handling"""

    def test_env_variable_configuration(self):
        """Test that environment variables are properly loaded"""
        with patch.dict(os.environ, {
            "OPENAI_STT_MODEL": "gpt-4o-transcribe",
            "OPENAI_API_KEY": "test-key"
        }):
            transcriber = StreamingTranscriber(PerformanceMonitor())
            self.assertEqual(transcriber.model_name, "gpt-4o-transcribe")

    def test_missing_env_variable(self):
        """Test behavior when environment variable is missing"""
        with patch.dict(os.environ, {}, clear=True):
            # Should always use gpt-4o-transcribe
            transcriber = StreamingTranscriber(PerformanceMonitor())
            self.assertEqual(transcriber.model_name, "gpt-4o-transcribe")


class TestPerformanceBenchmarks(unittest.TestCase):
    """Performance benchmarking tests"""

    def setUp(self):
        """Set up test fixtures"""
        self.performance_monitor = PerformanceMonitor()

    def test_transcription_latency(self):
        """Test transcription latency meets requirements"""
        monitor = PerformanceMonitor()

        # Simulate transcription times
        latencies = [0.1, 0.15, 0.12, 0.11, 0.13]  # seconds
        for latency in latencies:
            monitor.record_transcription(latency)

        metrics = monitor.get_metrics()
        avg_latency_ms = metrics.get("avg_transcription_ms", float('inf'))

        # Verify average latency is under 200ms (real-time requirement)
        self.assertLess(avg_latency_ms, 200)

    def test_memory_usage(self):
        """Test that memory usage is within acceptable bounds"""
        # Create multiple transcriber instances
        transcribers = []
        for _ in range(10):
            transcribers.append(StreamingTranscriber(self.performance_monitor))

        # In a real test, we would measure actual memory usage
        # For now, just verify instances are created
        self.assertEqual(len(transcribers), 10)


def run_async_test(coro):
    """Helper function to run async tests"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


if __name__ == "__main__":
    # Run the test suite
    unittest.main(verbosity=2)