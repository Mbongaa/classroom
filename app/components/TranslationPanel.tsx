'use client';

import { useRoomContext } from '@livekit/components-react';
import { useState, useEffect, useRef } from 'react';
import { TranscriptionSegment, RoomEvent } from 'livekit-client';
import { Languages } from 'lucide-react';
import styles from './TranslationPanel.module.css';

interface TranslationPanelProps {
  captionsLanguage: string;
  onClose?: () => void;
  showCloseButton?: boolean;
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
}: TranslationPanelProps) {
  const room = useRoomContext();
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [isReceiving, setIsReceiving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments: TranscriptionSegment[]) => {
      // Filter segments for the selected language
      const filteredSegments = segments.filter((seg) => seg.language === captionsLanguage);

      // Add new translations to the list
      const newEntries = filteredSegments.map((segment) => ({
        id: segment.id,
        text: segment.text,
        timestamp: new Date(),
        participantName: 'Teacher', // Translations come from the teacher via agent
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
  }, [room, captionsLanguage]);

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
