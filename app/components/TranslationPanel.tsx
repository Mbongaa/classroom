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
}

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
  const [isReceiving, setIsReceiving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const savedSegmentIds = useRef<Set<string>>(new Set()); // Track saved segments to prevent duplicates
  const sessionId = generateSessionId(roomName);

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments: TranscriptionSegment[]) => {
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
        const finalSegments = segments.filter(seg => seg.final);

        // Detect speaker's original language based on role
        // For teacher's client: teacher is local, students are remote
        // For student's client: teacher is remote, student is local
        const speakingLanguage = userRole === 'teacher'
          ? room.localParticipant?.attributes?.speaking_language
          : Array.from(room.remoteParticipants.values())
              .find(p => p.attributes?.speaking_language !== undefined)
              ?.attributes?.speaking_language;

        // Teachers save ONLY transcription (original language)
        if (userRole === 'teacher') {
          const transcription = finalSegments.find(seg => seg.language === speakingLanguage);
          if (transcription) {
            const segmentKey = `${transcription.id}-${transcription.language}`;
            if (!savedSegmentIds.current.has(segmentKey)) {
              savedSegmentIds.current.add(segmentKey);

              const timestampMs = Date.now() - sessionStartTime;
              fetch('/api/transcriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId, // Use session_id instead of recording_id
                  text: transcription.text,
                  language: transcription.language,
                  participantIdentity: room.localParticipant?.identity || 'unknown',
                  participantName: room.localParticipant?.name || 'Teacher',
                  timestampMs,
                }),
              })
                .then(() => console.log('[TranslationPanel] Teacher saved TRANSCRIPTION:', transcription.language, timestampMs))
                .catch(err => {
                  console.error('[TranslationPanel] Save error:', err);
                  savedSegmentIds.current.delete(segmentKey);
                });
            }
          }
        }

        // Students save ONLY their caption language (translation)
        if (userRole === 'student') {
          const translation = finalSegments.find(seg => seg.language === captionsLanguage);
          if (translation && translation.language !== speakingLanguage) {
            const segmentKey = `${translation.id}-${translation.language}`;
            if (!savedSegmentIds.current.has(segmentKey)) {
              savedSegmentIds.current.add(segmentKey);

              const timestampMs = Date.now() - sessionStartTime;
              // Get teacher's name from remote participants (for students)
              const teacher = Array.from(room.remoteParticipants.values())
                .find(p => p.attributes?.speaking_language !== undefined);
              fetch('/api/recordings/translations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId, // Use session_id instead of recording_id
                  text: translation.text,
                  language: translation.language,
                  participantName: teacher?.name || 'Teacher',
                  timestampMs,
                }),
              })
                .then(() => console.log('[TranslationPanel] Student saved TRANSLATION:', translation.language, timestampMs))
                .catch(err => {
                  console.error('[TranslationPanel] Save error:', err);
                  savedSegmentIds.current.delete(segmentKey);
                });
            }
          }
        }
      }

      // Filter segments for DISPLAY only (selected language)
      const filteredSegments = segments.filter((seg) => {
        return seg.language === captionsLanguage;
      });

      // Add filtered translations to UI display
      const newEntries = filteredSegments.map((segment) => ({
        id: segment.id,
        text: segment.text,
        timestamp: new Date(),
        participantName: 'Teacher',
        language: segment.language,
      }));

      if (newEntries.length > 0) {
        setTranslations((prev) => {
          // Keep only last 100 translations to prevent memory issues
          const updated = [...prev, ...newEntries];
          if (updated.length > 100) {
            return updated.slice(-100);
          }
          return updated;
        });

        // Show receiving indicator
        setIsReceiving(true);
        lastUpdateRef.current = Date.now();

        // Hide indicator after a short delay
        setTimeout(() => {
          if (Date.now() - lastUpdateRef.current >= 1500) {
            setIsReceiving(false);
          }
        }, 2000);
      }
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);

    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room, captionsLanguage, sessionId, sessionStartTime, userRole]);

  // Auto-scroll to bottom when new translations arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [translations]);

  // Format timestamp to readable time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Get language name from code
  const getLanguageName = (code: string) => {
    const languages: { [key: string]: string } = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ja: 'Japanese',
      ar: 'Arabic',
      cmn: 'Chinese',
      pt: 'Portuguese',
      ru: 'Russian',
      ko: 'Korean',
    };
    return languages[code] || code.toUpperCase();
  };

  if (translations.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <Languages className={styles.globeIcon} size={32} />
          <div className={styles.pulseRing}></div>
        </div>
        <h3 className={styles.emptyTitle}>Waiting for translations...</h3>
        <p className={styles.emptyDescription}>
          Translations will appear here when the teacher speaks
        </p>
        <div className={styles.languageIndicator}>
          <span className={styles.languageLabel}>Selected Language:</span>
          <span className={styles.languageBadge}>{getLanguageName(captionsLanguage)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Languages className={styles.headerIcon} size={20} />
          <span className={styles.headerTitle}>Live Translations</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.languageBadge}>{getLanguageName(captionsLanguage)}</span>
          <span className={styles.messageCountBadge}>{translations.length}</span>
          {showCloseButton && onClose && (
            <button className={styles.closeButton} onClick={onClose} aria-label="Close translation">
              ×
            </button>
          )}
        </div>
      </div>

      {/* Translation list */}
      <div className={styles.translationList} ref={scrollRef}>
        {translations.map((entry, index) => {
          const isLatest = index === translations.length - 1;
          return (
            <div
              key={entry.id}
              className={`${styles.translationItem} ${isLatest ? styles.latest : ''}`}
            >
              <div className={styles.translationHeader}>
                <span className={styles.speaker}>
                  <span className={styles.speakerIcon}>👤</span>
                  {entry.participantName}
                </span>
                <span className={styles.timestamp}>{formatTime(entry.timestamp)}</span>
              </div>
              <div className={styles.translationText}>{entry.text}</div>
              {isLatest && (
                <div className={styles.latestIndicator}>
                  <span className={styles.latestBadge}>Latest</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
