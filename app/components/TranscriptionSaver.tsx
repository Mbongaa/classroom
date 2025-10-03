'use client';

import { useEffect, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { TranscriptionSegment, RoomEvent } from 'livekit-client';
import { SessionMetadata } from '@/lib/types';

interface TranscriptionSaverProps {
  sessionMetadata?: SessionMetadata | null;
}

/**
 * Invisible component that listens to transcription events and saves them for teachers.
 * This component has no UI - it only handles the transcription saving logic.
 * Mounted only by teachers to save transcriptions in their speaking language.
 */
export default function TranscriptionSaver({ sessionMetadata }: TranscriptionSaverProps) {
  const room = useRoomContext();
  const savedSegmentIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!room || !sessionMetadata) return;

    const handleTranscription = (segments: TranscriptionSegment[]) => {
      // Only process final segments to avoid duplicates
      const finalSegments = segments.filter(seg => seg.final);

      // Get teacher's speaking language from local participant attributes
      const speakingLanguage = room.localParticipant?.attributes?.speaking_language;

      if (!speakingLanguage) {
        console.log('[TranscriptionSaver] No speaking language set for teacher');
        return;
      }

      // Debug log to trace what we're receiving
      console.log('[DEBUG TranscriptionSaver] Received segments:',
        segments.map(s => ({
          id: s.id,
          language: s.language,
          text: s.text.substring(0, 50),
          final: s.final,
        }))
      );

      // Find and save transcription in teacher's speaking language
      const transcription = finalSegments.find(seg => seg.language === speakingLanguage);

      if (transcription) {
        const segmentKey = `${transcription.id}-${transcription.language}`;

        // Check if we've already saved this segment
        if (!savedSegmentIds.current.has(segmentKey)) {
          savedSegmentIds.current.add(segmentKey);

          const timestampMs = Date.now() - sessionMetadata.startTime;

          // Save to transcriptions API
          fetch('/api/transcriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recordingId: sessionMetadata.recordingId,
              text: transcription.text,
              language: transcription.language,
              participantIdentity: room.localParticipant?.identity || 'unknown',
              participantName: room.localParticipant?.name || 'Teacher',
              timestampMs,
            }),
          })
            .then(response => response.json())
            .then(data => {
              console.log('[TranscriptionSaver] Teacher saved TRANSCRIPTION:',
                transcription.language, timestampMs, 'Entry ID:', data.entry?.id);
            })
            .catch(err => {
              console.error('[TranscriptionSaver] Save error:', err);
              // Remove from saved set so we can retry
              savedSegmentIds.current.delete(segmentKey);
            });
        }
      } else {
        console.log('[TranscriptionSaver] No transcription found for language:', speakingLanguage);
      }
    };

    // Subscribe to transcription events
    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    console.log('[TranscriptionSaver] Listening for transcriptions, speaking language:',
      room.localParticipant?.attributes?.speaking_language);

    // Cleanup
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room, sessionMetadata]);

  // No UI - this component is invisible
  return null;
}