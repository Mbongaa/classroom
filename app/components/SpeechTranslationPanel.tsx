import React, { useState, useEffect, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { TranscriptionSegment, RoomEvent } from 'livekit-client';
import { Languages } from 'lucide-react';
import styles from './SpeechTranslationPanel.module.css';

interface SpeechTranslationPanelProps {
  targetLanguage: string;
  onClose?: () => void;
  hideCloseButton?: boolean;
  roomName: string;
  sessionStartTime: number;
  sessionId: string;
  userRole?: 'teacher' | 'student' | null;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Start with 1 second, exponential backoff

const SpeechTranslationPanel: React.FC<SpeechTranslationPanelProps> = ({
  targetLanguage,
  onClose,
  hideCloseButton = false,
  roomName,
  sessionStartTime,
  sessionId,
  userRole,
}) => {
  const room = useRoomContext();
  const [translatedSegments, setTranslatedSegments] = useState<
    Array<{
      id: string;
      speaker?: string;
      text: string;
      timestamp: number;
      isLatest?: boolean;
    }>
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const savedSegmentIds = useRef<Set<string>>(new Set()); // Track saved segments to prevent duplicates

  // Listen for transcription events from the room
  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments: TranscriptionSegment[]) => {
      // DEBUG: Log ALL incoming segments
      console.log(
        '[DEBUG SpeechTranslationPanel] Received segments:',
        segments.map((s) => ({
          id: s.id,
          language: s.language,
          text: s.text.substring(0, 50),
          final: s.final,
        })),
      );

      // Save only what THIS participant is consuming (prevent N-participant multiplication)
      if (userRole) {
        const finalSegments = segments.filter((seg) => seg.final);

        // Detect speaker's original language (teacher's language from remote participants)
        // For student's client: teacher is remote, student is local
        const speakingLanguage = Array.from(room.remoteParticipants.values()).find(
          (p) => p.attributes?.speaking_language !== undefined,
        )?.attributes?.speaking_language;

        // Students save ONLY their caption language (translation)
        // Note: Teachers use TranscriptionSaver component for original transcriptions
        if (userRole === 'student') {
          const translation = finalSegments.find((seg) => seg.language === targetLanguage);
          if (translation && translation.language !== speakingLanguage) {
            const segmentKey = `${translation.id}-${translation.language}`;
            if (!savedSegmentIds.current.has(segmentKey)) {
              savedSegmentIds.current.add(segmentKey);

              const timestampMs = Date.now() - sessionStartTime;
              // Get teacher's name from remote participants (for students)
              const speaker = Array.from(room.remoteParticipants.values()).find(
                (p) => p.attributes?.speaking_language !== undefined,
              );

              // Save with retry logic
              const saveWithRetry = async (attempt = 1): Promise<void> => {
                try {
                  const response = await fetch('/api/recordings/translations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sessionId,
                      text: translation.text,
                      language: translation.language,
                      participantName:
                        room.localParticipant?.name || room.localParticipant?.identity || 'Student', // Save the student's name who receives the translation
                      timestampMs,
                    }),
                  });

                  if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API error (${response.status}): ${errorText}`);
                  }

                  const data = await response.json();
                  console.log(
                    '[SpeechTranslationPanel] ✅ Student saved TRANSLATION:',
                    translation.language,
                    timestampMs,
                    'Entry ID:',
                    data.entry?.id,
                  );
                } catch (err) {
                  console.error(
                    `[SpeechTranslationPanel] ❌ Save error (attempt ${attempt}/${MAX_RETRIES}):`,
                    err,
                  );

                  // Retry with exponential backoff
                  if (attempt < MAX_RETRIES) {
                    const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                    console.log(`[SpeechTranslationPanel] Retrying in ${delay}ms...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    return saveWithRetry(attempt + 1);
                  } else {
                    console.error(
                      '[SpeechTranslationPanel] ⚠️ FAILED after',
                      MAX_RETRIES,
                      'attempts. Data lost:',
                      {
                        text: translation.text.substring(0, 100),
                        timestamp: timestampMs,
                        sessionId,
                      },
                    );
                    savedSegmentIds.current.delete(segmentKey); // Allow retry on next segment
                  }
                }
              };

              saveWithRetry();
            }
          }
        }
      }

      // Filter segments for DISPLAY only (selected language)
      const filteredSegments = segments.filter((seg) => {
        return seg.language === targetLanguage && seg.final;
      });

      // Process new segments for display
      const newSegments = filteredSegments.map((seg, index) => ({
        id: seg.id || `seg-${Date.now()}-${index}`,
        speaker: 'Speaker',
        text: seg.text,
        timestamp: Date.now(),
        isLatest: false,
      }));

      if (newSegments.length > 0) {
        setTranslatedSegments((prev) => {
          // Add new segments and keep only last 100
          const updated = [...prev.map((s) => ({ ...s, isLatest: false })), ...newSegments];
          // Mark the last one as latest
          if (updated.length > 0) {
            updated[updated.length - 1].isLatest = true;
          }
          // Keep only last 100 segments to prevent memory issues
          if (updated.length > 100) {
            return updated.slice(-100);
          }
          return updated;
        });

        lastUpdateRef.current = Date.now();
      }
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);

    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room, targetLanguage, sessionId, sessionStartTime, userRole]);

  // Auto-scroll to latest translation
  useEffect(() => {
    if (scrollRef.current && translatedSegments.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [translatedSegments]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getLanguageLabel = (lang: string) => {
    const languages: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ja: 'Japanese',
      'zh-CN': 'Chinese',
      ar: 'Arabic',
      hi: 'Hindi',
      pt: 'Portuguese',
      ru: 'Russian',
    };
    return languages[lang] || lang.toUpperCase();
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Languages className={styles.headerIcon} size={20} />
          <span className={styles.headerTitle}>Live Translation</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.languageBadge}>{getLanguageLabel(targetLanguage)}</span>
          {translatedSegments.length > 0 && (
            <span className={styles.messageCountBadge}>{translatedSegments.length}</span>
          )}
          <div className={styles.liveIndicator}>
            <span className={styles.liveDot}></span>
            <span>LIVE</span>
          </div>
          {!hideCloseButton && onClose && (
            <button onClick={onClose} className={styles.closeButton}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Translation List */}
      <div className={styles.translationList} ref={scrollRef}>
        {translatedSegments.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Languages className={styles.globeIcon} size={64} />
              <span className={styles.pulseRing}></span>
            </div>
            <div className={styles.emptyTitle}>Waiting for Translation</div>
            <div className={styles.emptyDescription}>
              Translations will appear here as the speaker talks
            </div>
            <div className={styles.languageIndicator}>
              <span className={styles.languageLabel}>Translating to</span>
              <span>{getLanguageLabel(targetLanguage)}</span>
            </div>
          </div>
        ) : (
          translatedSegments.map((segment) => (
            <div
              key={segment.id}
              className={`${styles.translationItem} ${segment.isLatest ? styles.latest : ''}`}
            >
              {segment.isLatest && (
                <div className={styles.latestIndicator}>
                  <span className={styles.latestBadge}>LATEST</span>
                </div>
              )}
              <div className={styles.translationHeader}>
                <div className={styles.speaker}>
                  <span className={styles.speakerIcon}>👤</span>
                  <span>{segment.speaker}</span>
                </div>
                <span className={styles.timestamp}>{formatTime(segment.timestamp)}</span>
              </div>
              <div className={styles.translationText}>{segment.text}</div>
            </div>
          ))
        )}
      </div>

      {/* Status Bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusLeft}>
          <span className={styles.statusIcon}>📡</span>
          <span className={styles.statusText}>
            {translatedSegments.length === 0 ? 'Waiting for audio...' : 'Receiving translations'}
          </span>
        </div>
        <div className={styles.statusRight}>
          <span className={styles.messageCount}>
            {translatedSegments.length} message{translatedSegments.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SpeechTranslationPanel;
