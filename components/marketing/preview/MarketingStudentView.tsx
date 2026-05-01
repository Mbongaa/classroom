'use client';

import { useRef, useState } from 'react';
import { ArrowLeftIcon } from '@/components/ui/arrow-left';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import styles from '@/app/rooms/[roomName]/SpeechClient.module.css';
import { MarketingTranslationPanel, type MarketingSegment } from './MarketingTranslationPanel';
import { MarketingTeacherTile } from './MarketingTeacherTile';
import { timedTranscript } from './demoData';

const PROCESSING_DELAY = 2.0;
const MAX_SEGMENTS = 8;

interface MarketingStudentViewProps {
  variant?: 'desktop' | 'mobile';
  /** When true, fill the parent's height instead of using a fixed/clamped height. */
  fillParent?: boolean;
}

export function MarketingStudentView({
  variant = 'desktop',
  fillParent = false,
}: MarketingStudentViewProps) {
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const videoTimeRef = useRef(0);
  const processedRef = useRef<Set<number>>(new Set());

  const handleVideoTime = (time: number) => {
    if (videoTimeRef.current > 50 && time < 5) {
      processedRef.current = new Set();
      setSegments([]);
    }
    videoTimeRef.current = time;
    if (time < PROCESSING_DELAY) return;

    const adjusted = time - PROCESSING_DELAY;
    const segment = timedTranscript.find(
      (s) => adjusted >= s.startTime && adjusted < s.endTime,
    );
    if (segment && !processedRef.current.has(segment.id)) {
      processedRef.current.add(segment.id);
      setSegments((prev) => {
        const next = [...prev, { id: segment.id, text: segment.translation.en }];
        return next.slice(-MAX_SEGMENTS);
      });
    }
  };

  const isMobile = variant === 'mobile';

  return (
    <div
      className={styles.speechContainer}
      data-lk-theme="default"
      // Override the production module's `position: fixed; height: 100vh` —
      // we are mounting this inside the marketing page, not as a fullscreen route.
      style={{
        position: 'relative',
        inset: 'auto',
        height: fillParent ? '100%' : isMobile ? 600 : 'min(72vh, 640px)',
        flex: fillParent ? '1 1 auto' : undefined,
        minHeight: fillParent ? 0 : undefined,
        // Edge-to-edge when filling parent (no card chrome — the hero IS the surface).
        borderRadius: fillParent ? 0 : isMobile ? 20 : 24,
        boxShadow: fillParent
          ? 'none'
          : '0 1px 1px oklch(0.20 0.02 200 / 0.04), 0 12px 32px oklch(0.20 0.02 200 / 0.10), 0 40px 100px oklch(0.20 0.02 200 / 0.18)',
        border: fillParent ? 'none' : '1px solid oklch(0.30 0.020 200)',
      }}
    >
      {/* Production student-view header is intentionally suppressed when this view IS the hero —
         the marketing nav floats over the top instead. We still render an invisible spacer
         so the production layout keeps its expected vertical rhythm. */}
      {!fillParent && (
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.roomInfo}>
              <button type="button" tabIndex={-1} aria-hidden className={styles.backButton}>
                <ArrowLeftIcon size={16} />
              </button>
              <span className={styles.roomName}>Al Furqaan</span>
            </div>
            <div className={styles.headerControls}>
              <ThemeToggleButton start="top-right" className="size-7 md:size-10" />
            </div>
          </div>
        </div>
      )}

      <div className={`${styles.mainContainer} ${styles.withTranslation}`}>
        <div
          className={styles.videoArea}
          style={
            isMobile
              ? {
                  display: 'grid',
                  gridTemplateRows: 'minmax(220px, 38%) minmax(0, 1fr)',
                  gap: 0,
                  flex: 1,
                  minHeight: 0,
                }
              : undefined
          }
        >
          {/* Translation sidebar — 70% on desktop (left), bottom row on mobile (grid order 2) */}
          <div
            className={
              isMobile
                ? styles.translationPanelMobile
                : `${styles.translationSidebar} ${styles.desktopOnly}`
            }
            style={
              isMobile
                ? {
                    display: 'flex',
                    gridRow: 2,
                    minHeight: 0,
                    overflow: 'hidden',
                  }
                : { display: 'flex', width: '70%', maxWidth: 'none' }
            }
          >
            <MarketingTranslationPanel
              segments={segments}
              targetLanguage="en"
              participantCount={12}
              variant={variant}
            />
          </div>

          {/* Main video section — right of sidebar on desktop, top row on mobile (grid order 1) */}
          <div
            className={styles.mainVideoSection}
            style={
              isMobile
                ? {
                    gridRow: 1,
                    margin: '0.5rem 0.5rem 0',
                    minHeight: 0,
                  }
                : undefined
            }
          >
            <div className={styles.mainVideoGrid} style={isMobile ? { padding: '0.5rem' } : undefined}>
              <div className={styles.teacherVideo} style={{ aspectRatio: 'auto' }}>
                <MarketingTeacherTile
                  videoSrc="/marketing/camera-preview.mp4"
                  name="Sheikh Ahmad"
                  className={styles.teacherTile}
                  onTimeUpdate={handleVideoTime}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
