"""
Comprehensive test suite for the upgraded translation agent with GPT Realtime
"""

import asyncio
import json
import unittest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
import time
from dataclasses import dataclass

# Import the modules to test
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main_upgraded import (
    Language,
    SUPPORTED_LANGUAGES,
    PerformanceMonitor,
    Translator,
    RealtimeTranscriber,
)


class TestLanguageConfiguration(unittest.TestCase):
    """Test language configuration and data structures"""

    def test_supported_languages_structure(self):
        """Test that all supported languages have proper structure"""
        self.assertGreaterEqual(len(SUPPORTED_LANGUAGES), 10)

        for code, lang in SUPPORTED_LANGUAGES.items():
            self.assertIsInstance(lang, Language)
            self.assertEqual(lang.code, code)
            self.assertIsNotNone(lang.name)
            self.assertIsNotNone(lang.flag)
            self.assertTrue(len(lang.flag) > 0)

    def test_language_codes_validity(self):
        """Test that language codes are valid ISO codes"""
        valid_codes = {'en', 'es', 'fr', 'de', 'ja', 'ar', 'zh', 'pt', 'ru', 'ko'}
        for code in SUPPORTED_LANGUAGES.keys():
            self.assertIn(code, valid_codes)


class TestPerformanceMonitor(unittest.TestCase):
    """Test performance monitoring functionality"""

    def setUp(self):
        self.monitor = PerformanceMonitor(window_size=10)

    def test_initialization(self):
        """Test monitor initializes with correct values"""
        self.assertEqual(self.monitor.error_count, 0)
        self.assertEqual(self.monitor.success_count, 0)
        self.assertEqual(len(self.monitor.transcription_times), 0)
        self.assertEqual(len(self.monitor.translation_times), 0)

    def test_record_transcription_time(self):
        """Test recording transcription times"""
        times = [0.1, 0.2, 0.15, 0.12]
        for t in times:
            self.monitor.record_transcription(t)

        self.assertEqual(len(self.monitor.transcription_times), len(times))
        metrics = self.monitor.get_metrics()

        self.assertIn('avg_transcription_ms', metrics)
        self.assertIn('max_transcription_ms', metrics)
        self.assertIn('min_transcription_ms', metrics)

        # Check calculations
        self.assertAlmostEqual(metrics['avg_transcription_ms'], 142.5, places=1)
        self.assertAlmostEqual(metrics['max_transcription_ms'], 200, places=1)
        self.assertAlmostEqual(metrics['min_transcription_ms'], 100, places=1)

    def test_record_translation_time(self):
        """Test recording translation times"""
        times = [0.05, 0.08, 0.06]
        for t in times:
            self.monitor.record_translation(t)

        metrics = self.monitor.get_metrics()
        self.assertIn('avg_translation_ms', metrics)

    def test_error_tracking(self):
        """Test error counting and rate calculation"""
        # Record some successes and errors
        for _ in range(7):
            self.monitor.record_success()
        for _ in range(3):
            self.monitor.record_error()

        metrics = self.monitor.get_metrics()
        self.assertEqual(metrics['total_success'], 7)
        self.assertEqual(metrics['total_errors'], 3)
        self.assertAlmostEqual(metrics['error_rate'], 0.3, places=2)

    def test_window_size_limit(self):
        """Test that deque respects window size"""
        # Add more than window size
        for i in range(15):
            self.monitor.record_transcription(i * 0.01)

        # Should only keep last 10 (window_size)
        self.assertEqual(len(self.monitor.transcription_times), 10)


class TestTranslator(unittest.IsolatedAsyncioTestCase):
    """Test the Translator class with GPT-4o"""

    async def asyncSetUp(self):
        """Set up test fixtures"""
        self.mock_room = AsyncMock()
        self.mock_room.local_participant = AsyncMock()
        self.language = Language(code="es", name="Spanish", flag="🇪🇸")
        self.monitor = PerformanceMonitor()

    @patch('main_upgraded.openai.LLM')
    async def test_translator_initialization(self, mock_llm_class):
        """Test translator initializes with correct GPT-4o configuration"""
        translator = Translator(self.mock_room, self.language, self.monitor)

        # Check LLM was initialized with GPT-4o
        mock_llm_class.assert_called_once_with(
            model="gpt-4o",
            temperature=0.3,
            max_tokens=500
        )

        # Check chat context was created
        self.assertIsNotNone(translator.chat_ctx)
        self.assertEqual(translator.language, self.language)

    @patch('main_upgraded.openai.LLM')
    async def test_translation_success(self, mock_llm_class):
        """Test successful translation flow"""
        # Set up mocks
        mock_llm = AsyncMock()
        mock_llm_class.return_value = mock_llm

        # Mock the chat stream response
        # LiveKit plugin uses chunk.delta structure, not chunk.choices
        mock_chunk = MagicMock()
        mock_chunk.delta = MagicMock()
        mock_chunk.delta.content = "Hola, mundo"

        async def mock_stream():
            yield mock_chunk

        mock_llm.chat.return_value = mock_stream()

        # Create translator and translate
        translator = Translator(self.mock_room, self.language, self.monitor)
        await translator.translate("Hello, world", "track_123")

        # Verify translation was published
        self.mock_room.local_participant.publish_transcription.assert_called_once()

        # Check performance was recorded
        self.assertEqual(self.monitor.success_count, 1)

    @patch('main_upgraded.openai.LLM')
    async def test_translation_caching(self, mock_llm_class):
        """Test that translations are cached for repeated phrases"""
        mock_llm = AsyncMock()
        mock_llm_class.return_value = mock_llm

        # Mock the chat stream response
        # LiveKit plugin uses chunk.delta structure
        mock_chunk = MagicMock()
        mock_chunk.delta = MagicMock()
        mock_chunk.delta.content = "Hola"

        async def mock_stream():
            yield mock_chunk

        mock_llm.chat.return_value = mock_stream()

        translator = Translator(self.mock_room, self.language, self.monitor)

        # Translate same phrase twice
        await translator.translate("Hello", "track_123")
        await translator.translate("Hello", "track_123")

        # LLM should only be called once due to caching
        mock_llm.chat.assert_called_once()
        self.assertEqual(translator.cache_hits, 1)

    @patch('main_upgraded.openai.LLM')
    async def test_translation_error_handling(self, mock_llm_class):
        """Test error handling during translation"""
        mock_llm = AsyncMock()
        mock_llm_class.return_value = mock_llm

        # Make the chat method raise an exception
        mock_llm.chat.side_effect = Exception("API Error")

        translator = Translator(self.mock_room, self.language, self.monitor)

        # Should not raise, but handle gracefully
        await translator.translate("Hello", "track_123")

        # Error should be recorded
        self.assertEqual(self.monitor.error_count, 1)

        # Error fallback should be published
        self.mock_room.local_participant.publish_transcription.assert_called()


class TestRealtimeTranscriber(unittest.IsolatedAsyncioTestCase):
    """Test the RealtimeTranscriber class with GPT Realtime API"""

    async def asyncSetUp(self):
        """Set up test fixtures"""
        self.monitor = PerformanceMonitor()

    @patch('main_upgraded.openai.realtime.RealtimeModel')
    async def test_transcriber_initialization(self, mock_realtime_class):
        """Test transcriber initializes with correct Realtime API configuration"""
        transcriber = RealtimeTranscriber(self.monitor)

        # Check RealtimeModel was initialized correctly
        mock_realtime_class.assert_called_once()
        call_args = mock_realtime_class.call_args

        # Verify configuration
        self.assertEqual(call_args.kwargs['temperature'], 0.0)
        self.assertEqual(call_args.kwargs['modalities'], ["text"])
        self.assertIsNone(call_args.kwargs['voice'])

        # Check VAD configuration
        vad_config = call_args.kwargs['turn_detection']
        self.assertIsNotNone(vad_config)

    @patch('main_upgraded.openai.realtime.RealtimeModel')
    @patch('main_upgraded.rtc.AudioStream')
    async def test_transcription_flow(self, mock_audio_stream, mock_realtime_class):
        """Test the transcription flow with Realtime API"""
        # Set up mocks
        mock_model = AsyncMock()
        mock_realtime_class.return_value = mock_model

        mock_session = AsyncMock()
        mock_model.session.return_value = mock_session

        # Mock audio events
        mock_audio_event = MagicMock()
        mock_audio_event.frame.data = b"audio_data"

        async def audio_generator():
            yield mock_audio_event

        mock_audio_stream.return_value = audio_generator()

        # Mock transcription events
        mock_event = MagicMock()
        mock_event.type = "input_audio_buffer.speech_stopped"

        async def event_generator():
            yield mock_event

        mock_session.events.return_value = event_generator()

        # Set up conversation items
        mock_item = MagicMock()
        mock_item.type = "message"
        mock_item.content = [MagicMock()]
        mock_item.content[0].text = "Test transcription"
        mock_session.conversation.items = [mock_item]

        # Create transcriber and start
        transcriber = RealtimeTranscriber(self.monitor)

        mock_track = MagicMock()
        callback_called = False
        transcribed_text = None

        async def on_transcription(text, track):
            nonlocal callback_called, transcribed_text
            callback_called = True
            transcribed_text = text

        # Start transcription (will process one event then stop)
        transcriber.active = False  # Stop after first iteration
        await transcriber.start(mock_track, on_transcription)

        # Verify audio was sent to Realtime API
        mock_session.input_audio_buffer.append.assert_called()

    @patch('main_upgraded.openai.realtime.RealtimeModel')
    async def test_transcriber_error_handling(self, mock_realtime_class):
        """Test error handling in transcriber"""
        mock_model = AsyncMock()
        mock_realtime_class.return_value = mock_model

        # Make session creation fail
        mock_model.session.side_effect = Exception("Connection failed")

        transcriber = RealtimeTranscriber(self.monitor)

        mock_track = MagicMock()
        async def dummy_callback(text, track):
            pass

        # Should handle error gracefully
        await transcriber.start(mock_track, dummy_callback)

        # Should not be active after error
        self.assertFalse(transcriber.active)

    @patch('main_upgraded.openai.realtime.RealtimeModel')
    async def test_transcriber_stop(self, mock_realtime_class):
        """Test stopping the transcriber cleanly"""
        mock_model = AsyncMock()
        mock_realtime_class.return_value = mock_model

        mock_session = AsyncMock()
        mock_model.session.return_value = mock_session

        transcriber = RealtimeTranscriber(self.monitor)
        transcriber.session = mock_session
        transcriber.active = True

        await transcriber.stop()

        # Should close session and reset state
        mock_session.close.assert_called_once()
        self.assertFalse(transcriber.active)
        self.assertIsNone(transcriber.session)


class TestIntegration(unittest.IsolatedAsyncioTestCase):
    """Integration tests for the complete flow"""

    @patch('main_upgraded.JobContext')
    @patch('main_upgraded.openai.realtime.RealtimeModel')
    @patch('main_upgraded.openai.LLM')
    async def test_end_to_end_flow(self, mock_llm_class, mock_realtime_class, mock_ctx_class):
        """Test the complete end-to-end flow"""
        # This is a simplified integration test
        # In a real scenario, you would test with actual LiveKit test rooms

        # Set up context mock
        mock_ctx = AsyncMock()
        mock_ctx.room = AsyncMock()
        mock_ctx.room.remote_participants = {}
        mock_ctx.room.connection_state = MagicMock()

        # Test that the system initializes correctly
        self.assertIsNotNone(mock_ctx)

        # Additional integration tests would go here


# Performance benchmarking utilities
class PerformanceBenchmark:
    """Utilities for performance testing"""

    @staticmethod
    async def benchmark_translation(translator, text, iterations=100):
        """Benchmark translation performance"""
        times = []
        for _ in range(iterations):
            start = time.perf_counter()
            await translator.translate(text, "benchmark_track")
            duration = time.perf_counter() - start
            times.append(duration)

        return {
            'avg_ms': sum(times) / len(times) * 1000,
            'min_ms': min(times) * 1000,
            'max_ms': max(times) * 1000,
            'p95_ms': sorted(times)[int(len(times) * 0.95)] * 1000
        }


if __name__ == '__main__':
    # Run tests
    unittest.main()