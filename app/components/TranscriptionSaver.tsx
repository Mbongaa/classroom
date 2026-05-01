'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { TranscriptionSegment, RoomEvent } from 'livekit-client';
import { sentenceAccumulator } from '@/lib/sentence-accumulator';

interface TranscriptionSaverProps {
  roomName: string;
  sessionStartTime: number;
  sessionId: string;
  apiUrl?: string; // V2 passes '/api/v2/transcriptions'
}

// How long an incomplete sentence can sit in the accumulator before we force-save it.
// Speechmatics partial-finals arrive every few hundred ms during continuous speech,
// so a 4-second gap is a reliable signal that the speaker has paused without ending
// the sentence with punctuation.
const FLUSH_TIMEOUT_MS = 4000;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Invisible component, mounted only by the teacher, that listens for the
 * speaker's STT segments and persists complete sentences to the database.
 *
 * The Bayaan agent emits per-Speechmatics-chunk segments (often a few words at
 * a time, no punctuation per chunk). We feed those into a shared accumulator
 * that mirrors the agent's own `extract_complete_sentences` algorithm so the
 * persisted rows are full sentences instead of word fragments. The same
 * accumulator state is read by `SpeechTranslationPanel` to populate the
 * bilingual `original_text` for translation rows.
 */
export default function TranscriptionSaver({
  roomName: _roomName,
  sessionStartTime,
  sessionId,
  // Default to v2 — same reasoning as SpeechTranslationPanel: the legacy
  // endpoint silently 404s v2 sessions and starves the reaper's activity check.
  apiUrl = '/api/v2/transcriptions',
}: TranscriptionSaverProps) {
  const room = useRoomContext();

  // Speaker key under which we store accumulated state in the singleton.
  // Built lazily inside callbacks because the speaking_language attribute may
  // not be set yet at mount time.
  const buildSpeakerKey = useCallback(
    (lang: string) => `${sessionId}:${lang}`,
    [sessionId],
  );

  const saveSentence = useCallback(
    async (text: string, language: string, timestampMs: number) => {
      const fullText = text.trim();
      if (!fullText) return;

      const participantIdentity = room?.localParticipant?.identity || 'unknown';
      const participantName = room?.localParticipant?.name || 'Teacher';

      const attempt = async (n: number): Promise<void> => {
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              text: fullText,
              language,
              participantIdentity,
              participantName,
              timestampMs,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
          }

          const data = await response.json();
          console.log(
            '[TranscriptionSaver] ✅ Saved sentence:',
            language,
            timestampMs,
            'Entry ID:',
            data.entry?.id,
            '-',
            fullText.substring(0, 60) + (fullText.length > 60 ? '…' : ''),
          );
        } catch (err) {
          console.error(`[TranscriptionSaver] ❌ Save error (attempt ${n}/${MAX_RETRIES}):`, err);
          if (n < MAX_RETRIES) {
            const delay = RETRY_DELAY_MS * Math.pow(2, n - 1);
            await new Promise((r) => setTimeout(r, delay));
            return attempt(n + 1);
          }
          console.error('[TranscriptionSaver] ⚠️ FAILED after', MAX_RETRIES, 'attempts. Data lost:', {
            text: fullText.substring(0, 100),
            timestamp: timestampMs,
            sessionId,
          });
        }
      };

      void attempt(1);
    },
    [apiUrl, room, sessionId],
  );

  // Periodic flush for sentences that never see a final punctuation mark.
  useEffect(() => {
    const speakingLanguage = room?.localParticipant?.attributes?.speaking_language;
    if (!speakingLanguage) return;

    const key = buildSpeakerKey(speakingLanguage);

    const interval = setInterval(() => {
      if (!sentenceAccumulator.hasPendingText(key)) return;
      if (sentenceAccumulator.getTimeSinceLastUpdate(key) < FLUSH_TIMEOUT_MS) return;

      const flushed = sentenceAccumulator.flushRemaining(key);
      if (!flushed) return;

      const ts = flushed.startMs ?? Date.now() - sessionStartTime;
      console.log('[TranscriptionSaver] Timeout flush of incomplete sentence');
      void saveSentence(flushed.sentence, speakingLanguage, ts);
    }, 1000);

    return () => {
      clearInterval(interval);
      // Final flush on unmount so we don't lose the trailing sentence
      const flushed = sentenceAccumulator.flushRemaining(key);
      if (flushed) {
        const ts = flushed.startMs ?? Date.now() - sessionStartTime;
        void saveSentence(flushed.sentence, speakingLanguage, ts);
      }
    };
  }, [
    room,
    sessionStartTime,
    buildSpeakerKey,
    saveSentence,
    room?.localParticipant?.attributes?.speaking_language,
  ]);

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments: TranscriptionSegment[]) => {
      const speakingLanguage = room.localParticipant?.attributes?.speaking_language;
      if (!speakingLanguage) return;

      const key = buildSpeakerKey(speakingLanguage);

      for (const seg of segments) {
        if (!seg.final) continue;
        if (seg.language !== speakingLanguage) continue;
        if (!seg.text || !seg.text.trim()) continue;

        // Use wall-clock offset because the agent always sends start_time=0.
        const sessionTimeMs = Date.now() - sessionStartTime;

        const { completed, completedStartMs } = sentenceAccumulator.addChunk(
          key,
          seg.id,
          seg.text,
          sessionTimeMs,
        );

        if (completed.length > 0) {
          // Use the start time of the *first* chunk in the sentence so SRT cues
          // line up with when the speaker actually started speaking it.
          const startTs = completedStartMs ?? sessionTimeMs;
          for (const sentence of completed) {
            void saveSentence(sentence, speakingLanguage, startTs);
          }
        }
      }
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room, sessionStartTime, buildSpeakerKey, saveSentence]);

  return null;
}
