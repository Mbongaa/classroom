import React, { useState, useEffect, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { TranscriptionSegment, RoomEvent } from 'livekit-client';
import { Languages } from 'lucide-react';
import styles from './SpeechTranslationPanel.module.css';

interface SpeechTranslationPanelProps {
  targetLanguage: string;
  onClose?: () => void;
  hideCloseButton?: boolean;
}

const SpeechTranslationPanel: React.FC<SpeechTranslationPanelProps> = ({
  targetLanguage,
  onClose,
  hideCloseButton = false,
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
          languageType: typeof s.language,
          languageBytes: s.language ? Array.from(s.language).map((c) => c.charCodeAt(0)) : [],
        })),
      );

      console.log('[DEBUG SpeechTranslationPanel] Filtering for language:', {
        targetLanguage,
        targetLanguageType: typeof targetLanguage,
        targetLanguageBytes: targetLanguage
          ? Array.from(targetLanguage).map((c) => c.charCodeAt(0))
          : [],
      });

      // Filter segments for the selected language
      const filteredSegments = segments.filter((seg) => {
        const matches = seg.language === targetLanguage && seg.final;
        console.log(
          `[DEBUG SpeechTranslationPanel] Segment language "${seg.language}" (final: ${seg.final}) vs "${targetLanguage}" = ${matches}`,
        );
        return matches;
      });

      console.log(
        '[DEBUG SpeechTranslationPanel] Filtered segments count:',
        filteredSegments.length,
      );

      // Process new segments
      const newSegments = filteredSegments.map((seg, index) => ({
        id: seg.id || `seg-${Date.now()}-${index}`,
        speaker: 'Speaker', // LiveKit v2.x TranscriptionSegment doesn't include participant
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
  }, [room, targetLanguage]);

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
