import React, { useState, useEffect, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { TranscriptionSegment, RoomEvent } from 'livekit-client';
import { Languages } from 'lucide-react';
import styles from './SpeechTranslationPanel.module.css';
import { generateSessionId } from '@/lib/client-utils';

interface SpeechTranslationPanelProps {
  targetLanguage: string;
  onClose?: () => void;
  hideCloseButton?: boolean;
  roomName: string;
  sessionStartTime: number;
  userRole?: 'teacher' | 'student' | null;
}

const SpeechTranslationPanel: React.FC<SpeechTranslationPanelProps> = ({
  targetLanguage,
  onClose,
  hideCloseButton = false,
  roomName,
  sessionStartTime,
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
  const sessionId = generateSessionId(roomName);

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
                  participantName: room.localParticipant?.name || 'Speaker',
                  timestampMs,
                }),
              })
                .then(() => console.log('[SpeechTranslationPanel] Teacher saved TRANSCRIPTION:', transcription.language, timestampMs))
                .catch(err => {
                  console.error('[SpeechTranslationPanel] Save error:', err);
                  savedSegmentIds.current.delete(segmentKey);
                });
            }
          }
        }

        // Students save ONLY their caption language (translation)
        if (userRole === 'student') {
          const translation = finalSegments.find(seg => seg.language === targetLanguage);
          if (translation && translation.language !== speakingLanguage) {
            const segmentKey = `${translation.id}-${translation.language}`;
            if (!savedSegmentIds.current.has(segmentKey)) {
              savedSegmentIds.current.add(segmentKey);

              const timestampMs = Date.now() - sessionStartTime;
              // Get teacher's name from remote participants (for students)
              const speaker = Array.from(room.remoteParticipants.values())
                .find(p => p.attributes?.speaking_language !== undefined);
              fetch('/api/recordings/translations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId, // Use session_id instead of recording_id
                  text: translation.text,
                  language: translation.language,
                  participantName: speaker?.name || 'Speaker',
                  timestampMs,
                }),
              })
                .then(() => console.log('[SpeechTranslationPanel] Student saved TRANSLATION:', translation.language, timestampMs))
                .catch(err => {
                  console.error('[SpeechTranslationPanel] Save error:', err);
                  savedSegmentIds.current.delete(segmentKey);
                });
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
      cmn: 'Chinese',
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
