'use client';

import { useRoomContext } from '@livekit/components-react';
import { useState, useEffect, useRef } from 'react';
import { TranscriptionSegment, RoomEvent } from 'livekit-client';
import { Languages } from 'lucide-react';
import styles from './TranslationPanel.module.css';

import { generateSessionId } from '@/lib/client-utils';

interface TranslationPanelProps {
  captionsLanguage: string;
  onClose?: () => void;
  showCloseButton?: boolean;
  roomName: string;
  sessionStartTime: number;
  userRole?: 'teacher' | 'student' | null;
}

interface TranslationEntry {
  id: string;
  text: string;
  timestamp: Date;
  participantName?: string;
  language: string;
  isLatest?: boolean;
}

// Font size configuration
const DEFAULT_FONT_SIZE = 24;
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 32;
const FONT_STEP = 2;

// Health check configuration
const TRANSLATION_TIMEOUT_MS = 15000; // 15 seconds

export default function TranslationPanel({
  captionsLanguage,
  onClose,
  showCloseButton = false,
  roomName,
  sessionStartTime,
  userRole,
}: TranslationPanelProps) {
  const room = useRoomContext();
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const savedSegmentIds = useRef<Set<string>>(new Set());
  const sessionId = generateSessionId(roomName);

  // Translation service health tracking
  const [translationServiceStatus, setTranslationServiceStatus] = useState<
    'connecting' | 'active' | 'warning'
  >('connecting');
  const healthTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Translation service health monitoring
  useEffect(() => {
    if (!room) return;

    const startHealthTimer = () => {
      if (healthTimeoutRef.current) {
        clearTimeout(healthTimeoutRef.current);
      }
      healthTimeoutRef.current = setTimeout(() => {
        setTranslationServiceStatus('warning');
        console.warn('[Translation Health] ⚠️ No transcription received for', TRANSLATION_TIMEOUT_MS / 1000, 'seconds');
      }, TRANSLATION_TIMEOUT_MS);
    };

    startHealthTimer();

    return () => {
      if (healthTimeoutRef.current) {
        clearTimeout(healthTimeoutRef.current);
      }
    };
  }, [room]);

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments: TranscriptionSegment[]) => {
      // Reset health check timer
      if (healthTimeoutRef.current) {
        clearTimeout(healthTimeoutRef.current);
      }
      setTranslationServiceStatus('active');
      healthTimeoutRef.current = setTimeout(() => {
        setTranslationServiceStatus('warning');
        console.warn('[Translation Health] ⚠️ No transcription received for', TRANSLATION_TIMEOUT_MS / 1000, 'seconds');
      }, TRANSLATION_TIMEOUT_MS);

      // DEBUG: Log ALL incoming segments
      console.log(
        '[DEBUG TranslationPanel] Received segments:',
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

        const speakingLanguage =
          userRole === 'teacher'
            ? room.localParticipant?.attributes?.speaking_language
            : Array.from(room.remoteParticipants.values()).find(
                (p) => p.attributes?.speaking_language !== undefined,
              )?.attributes?.speaking_language;

        // Teachers save ONLY transcription (original language)
        if (userRole === 'teacher') {
          const transcription = finalSegments.find((seg) => seg.language === speakingLanguage);
          if (transcription) {
            const segmentKey = `${transcription.id}-${transcription.language}`;
            if (!savedSegmentIds.current.has(segmentKey)) {
              savedSegmentIds.current.add(segmentKey);

              const timestampMs = Date.now() - sessionStartTime;
              fetch('/api/transcriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId,
                  text: transcription.text,
                  language: transcription.language,
                  participantIdentity: room.localParticipant?.identity || 'unknown',
                  participantName: room.localParticipant?.name || 'Teacher',
                  timestampMs,
                }),
              })
                .then(() =>
                  console.log(
                    '[TranslationPanel] Teacher saved TRANSCRIPTION:',
                    transcription.language,
                    timestampMs,
                  ),
                )
                .catch((err) => {
                  console.error('[TranslationPanel] Save error:', err);
                  savedSegmentIds.current.delete(segmentKey);
                });
            }
          }
        }

        // Students save ONLY their caption language (translation)
        if (userRole === 'student') {
          const translation = finalSegments.find((seg) => seg.language === captionsLanguage);
          if (translation && translation.language !== speakingLanguage) {
            const segmentKey = `${translation.id}-${translation.language}`;
            if (!savedSegmentIds.current.has(segmentKey)) {
              savedSegmentIds.current.add(segmentKey);

              const timestampMs = Date.now() - sessionStartTime;
              const teacher = Array.from(room.remoteParticipants.values()).find(
                (p) => p.attributes?.speaking_language !== undefined,
              );
              fetch('/api/recordings/translations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId,
                  text: translation.text,
                  language: translation.language,
                  participantName: teacher?.name || 'Teacher',
                  timestampMs,
                }),
              })
                .then(() =>
                  console.log(
                    '[TranslationPanel] Student saved TRANSLATION:',
                    translation.language,
                    timestampMs,
                  ),
                )
                .catch((err) => {
                  console.error('[TranslationPanel] Save error:', err);
                  savedSegmentIds.current.delete(segmentKey);
                });
            }
          }
        }
      }

      // Filter segments for DISPLAY only (selected language)
      const filteredSegments = segments.filter((seg) => {
        return seg.language === captionsLanguage && seg.final;
      });

      // Add filtered translations to UI display
      const newEntries = filteredSegments.map((segment) => ({
        id: segment.id,
        text: segment.text,
        timestamp: new Date(),
        participantName: 'Teacher',
        language: segment.language,
        isLatest: false,
      }));

      if (newEntries.length > 0) {
        setTranslations((prev) => {
          const updated = [...prev.map((t) => ({ ...t, isLatest: false })), ...newEntries];
          if (updated.length > 0) {
            updated[updated.length - 1].isLatest = true;
          }
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
  }, [room, captionsLanguage, sessionId, sessionStartTime, userRole]);

  // Auto-scroll to bottom when new translations arrive
  useEffect(() => {
    if (scrollRef.current && translations.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [translations]);

  // Get language name from code
  const getLanguageName = (code: string) => {
    const languages: { [key: string]: string } = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ja: 'Japanese',
      ar: 'Arabic',
      'zh-CN': 'Chinese',
      pt: 'Portuguese',
      ru: 'Russian',
      ko: 'Korean',
      nl: 'Dutch',
      hi: 'Hindi',
    };
    return languages[code] || code.toUpperCase();
  };

  return (
    <div className={styles.container}>
      {/* Translation List - full height to top */}
      <div className={styles.translationList} ref={scrollRef}>
        {translations.length === 0 ? (
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
              <span>{getLanguageName(captionsLanguage)}</span>
            </div>
          </div>
        ) : (
          translations.map((entry) => (
            <div
              key={entry.id}
              className={`${styles.translationItem} ${entry.isLatest ? styles.latest : ''}`}
            >
              <div className={styles.translationText} style={{ fontSize: `${fontSize}px` }}>
                {entry.text}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Bar */}
      <div className={styles.bottomBar}>
        <div className={styles.bottomBarLeft}>
          <Languages className={styles.bottomBarIcon} size={18} />
          <span className={styles.bottomBarTitle}>Live Translation</span>
        </div>
        <div className={styles.bottomBarRight}>
          <span className={styles.languageBadge}>{getLanguageName(captionsLanguage)}</span>
          {translations.length > 0 && (
            <span className={styles.messageCountBadge}>{translations.length}</span>
          )}
          <div className={styles.fontControls}>
            <button
              onClick={() => setFontSize((prev) => Math.max(MIN_FONT_SIZE, prev - FONT_STEP))}
              disabled={fontSize <= MIN_FONT_SIZE}
              className={styles.fontButton}
              title="Decrease font size"
            >
              A-
            </button>
            <button
              onClick={() => setFontSize((prev) => Math.min(MAX_FONT_SIZE, prev + FONT_STEP))}
              disabled={fontSize >= MAX_FONT_SIZE}
              className={styles.fontButton}
              title="Increase font size"
            >
              A+
            </button>
          </div>
          <div className={`${styles.liveIndicator} ${translationServiceStatus === 'warning' ? styles.warningIndicator : ''}`}>
            <span className={`${styles.liveDot} ${translationServiceStatus === 'warning' ? styles.warningDot : translationServiceStatus === 'connecting' ? styles.connectingDot : ''}`}></span>
            <span>{translationServiceStatus === 'warning' ? 'OFFLINE' : translationServiceStatus === 'connecting' ? 'CONNECTING' : 'LIVE'}</span>
          </div>
          {showCloseButton && onClose && (
            <button onClick={onClose} className={styles.closeButton}>
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
