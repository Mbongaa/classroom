'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { TranscriptionSegment, RoomEvent } from 'livekit-client';

interface TranscriptionSaverProps {
  roomName: string;
  sessionStartTime: number;
  sessionId: string;
}

// Sentence boundary detection - multilingual punctuation
const SENTENCE_ENDERS = /[.!?؟。！？।॥]$/;

// Maximum chunks to accumulate before forcing flush (prevent memory issues)
const MAX_BUFFER_SIZE = 50;

// Timeout before flushing incomplete sentence (milliseconds)
const FLUSH_TIMEOUT = 3000; // 3 seconds

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Start with 1 second, exponential backoff

interface ChunkBuffer {
  id: string;
  text: string;
  timestamp_ms: number;
}

interface SentenceBuffer {
  chunks: ChunkBuffer[];
  lastUpdateTime: number;
}

/**
 * Invisible component that listens to transcription events and saves them for teachers.
 * This component has no UI - it only handles the transcription saving logic.
 * Mounted only by teachers to save transcriptions in their speaking language.
 * Now uses session_id instead of recording_id for proper separation.
 *
 * OPTIMIZATION: Accumulates chunks until sentence boundary detected (punctuation)
 * or timeout occurs, then saves complete sentences to reduce database writes by ~90%.
 */
export default function TranscriptionSaver({
  roomName,
  sessionStartTime,
  sessionId,
}: TranscriptionSaverProps) {
  const room = useRoomContext();
  const savedSegmentIds = useRef<Set<string>>(new Set());

  // Sentence accumulation buffer
  const sentenceBuffer = useRef<SentenceBuffer>({
    chunks: [],
    lastUpdateTime: Date.now(),
  });

  /**
   * Flush accumulated chunks as a complete sentence to the database
   */
  const flushSentence = useCallback(() => {
    if (sentenceBuffer.current.chunks.length === 0) {
      return;
    }

    const speakingLanguage = room?.localParticipant?.attributes?.speaking_language;
    if (!speakingLanguage) {
      console.warn('[TranscriptionSaver] Cannot flush - no speaking language set');
      return;
    }

    // Sort chunks by timestamp to handle out-of-order arrival
    const sortedChunks = [...sentenceBuffer.current.chunks].sort(
      (a, b) => a.timestamp_ms - b.timestamp_ms,
    );

    // Combine text with proper spacing
    const fullText = sortedChunks
      .map((c) => c.text)
      .join(' ')
      .trim();

    // Skip if result is empty
    if (!fullText) {
      console.log('[TranscriptionSaver] Skipping empty sentence after combining chunks');
      sentenceBuffer.current = { chunks: [], lastUpdateTime: Date.now() };
      return;
    }

    // Use earliest timestamp as sentence start time
    const sentenceTimestamp = sortedChunks[0].timestamp_ms;

    console.log('[TranscriptionSaver] Flushing complete sentence:', {
      chunkCount: sortedChunks.length,
      text: fullText.substring(0, 50) + (fullText.length > 50 ? '...' : ''),
      timestamp: sentenceTimestamp,
    });

    // Save to transcriptions API with retry logic
    const saveWithRetry = async (attempt = 1): Promise<void> => {
      try {
        const response = await fetch('/api/transcriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            text: fullText,
            language: speakingLanguage,
            participantIdentity: room.localParticipant?.identity || 'unknown',
            participantName: room.localParticipant?.name || 'Teacher',
            timestampMs: sentenceTimestamp,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        console.log(
          '[TranscriptionSaver] ✅ Saved complete sentence:',
          speakingLanguage,
          sentenceTimestamp,
          'Entry ID:',
          data.entry?.id,
        );
      } catch (err) {
        console.error(
          `[TranscriptionSaver] ❌ Save error (attempt ${attempt}/${MAX_RETRIES}):`,
          err,
        );

        // Retry with exponential backoff
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[TranscriptionSaver] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return saveWithRetry(attempt + 1);
        } else {
          console.error(
            '[TranscriptionSaver] ⚠️ FAILED after',
            MAX_RETRIES,
            'attempts. Data lost:',
            {
              text: fullText.substring(0, 100),
              timestamp: sentenceTimestamp,
              sessionId,
            },
          );
          // Could add user notification here (toast/alert)
        }
      }
    };

    saveWithRetry();

    // Clear buffer after successful flush
    sentenceBuffer.current = { chunks: [], lastUpdateTime: Date.now() };
  }, [room, sessionId]);

  // Timeout mechanism - flush buffer if no new chunks arrive within timeout period
  useEffect(() => {
    const timeoutInterval = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - sentenceBuffer.current.lastUpdateTime;

      if (timeSinceLastUpdate > FLUSH_TIMEOUT && sentenceBuffer.current.chunks.length > 0) {
        console.log(
          '[TranscriptionSaver] Timeout flush - no new chunks for',
          FLUSH_TIMEOUT / 1000,
          'seconds',
        );
        flushSentence();
      }
    }, 1000); // Check every second

    // Cleanup on component unmount
    return () => {
      clearInterval(timeoutInterval);

      // Force flush any remaining chunks when component unmounts
      if (sentenceBuffer.current.chunks.length > 0) {
        console.log('[TranscriptionSaver] Component unmount - flushing remaining chunks');
        flushSentence();
      }
    };
  }, [flushSentence]);

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments: TranscriptionSegment[]) => {
      // Only process final segments to avoid duplicates
      const finalSegments = segments.filter((seg) => seg.final);

      // Get teacher's speaking language from local participant attributes
      const speakingLanguage = room.localParticipant?.attributes?.speaking_language;

      if (!speakingLanguage) {
        console.log('[TranscriptionSaver] No speaking language set for teacher');
        return;
      }

      // Debug log to trace what we're receiving
      console.log(
        '[DEBUG TranscriptionSaver] Received segments:',
        segments.map((s) => ({
          id: s.id,
          language: s.language,
          text: s.text.substring(0, 50),
          final: s.final,
        })),
      );

      // Find transcription in teacher's speaking language
      const transcription = finalSegments.find((seg) => seg.language === speakingLanguage);

      if (transcription) {
        const segmentKey = `${transcription.id}-${transcription.language}`;

        // Check if we've already processed this segment
        if (savedSegmentIds.current.has(segmentKey)) {
          return;
        }
        savedSegmentIds.current.add(segmentKey);

        // Skip empty or whitespace-only chunks
        const trimmedText = transcription.text.trim();
        if (!trimmedText) {
          console.log('[TranscriptionSaver] Skipping empty chunk');
          return;
        }

        const timestampMs = Date.now() - sessionStartTime;

        // Add chunk to accumulation buffer
        sentenceBuffer.current.chunks.push({
          id: transcription.id,
          text: transcription.text,
          timestamp_ms: timestampMs,
        });
        sentenceBuffer.current.lastUpdateTime = Date.now();

        console.log('[TranscriptionSaver] Added chunk to buffer:', {
          text: trimmedText.substring(0, 30),
          bufferSize: sentenceBuffer.current.chunks.length,
          hasPunctuation: SENTENCE_ENDERS.test(trimmedText),
        });

        // Check for sentence boundary (punctuation at end)
        if (SENTENCE_ENDERS.test(trimmedText)) {
          console.log('[TranscriptionSaver] Sentence boundary detected - flushing');
          flushSentence();
          return;
        }

        // Safety check: Force flush if buffer exceeds maximum size
        if (sentenceBuffer.current.chunks.length >= MAX_BUFFER_SIZE) {
          console.warn('[TranscriptionSaver] Max buffer size reached - forcing flush');
          flushSentence();
        }
      } else {
        console.log('[TranscriptionSaver] No transcription found for language:', speakingLanguage);
      }
    };

    // Subscribe to transcription events
    room.on(RoomEvent.TranscriptionReceived, handleTranscription);

    // Only log if we have a speaking language set
    const speakingLanguage = room.localParticipant?.attributes?.speaking_language;
    if (speakingLanguage) {
      console.log(
        '[TranscriptionSaver] Listening for transcriptions, speaking language:',
        speakingLanguage,
      );
    } else {
      console.log('[TranscriptionSaver] Waiting for speaking language to be set...');
    }

    // Cleanup
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [
    room,
    sessionId,
    sessionStartTime,
    flushSentence,
    room?.localParticipant?.attributes?.speaking_language,
  ]);

  // No UI - this component is invisible
  return null;
}
