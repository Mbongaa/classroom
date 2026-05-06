'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { Volume2, VolumeOff } from 'lucide-react';
import { LottieIcon } from '@/components/lottie-icon';
import styles from '@/app/components/SpeechTranslationPanel.module.css';
import type { SegmentLocale } from './demoData';

/**
 * A segment carries its translations for every supported locale; the panel
 * renders the one matching the currently active marketing locale at render
 * time. This makes the cards reactive to locale changes — the existing
 * stack of translations re-renders in the new language without re-driving
 * the video timeline.
 */
export interface MarketingSegment {
  id: number;
  translations: Record<SegmentLocale, string>;
  isLatest?: boolean;
}

interface MarketingTranslationPanelProps {
  segments: MarketingSegment[];
  /**
   * Forces a specific target language. When omitted, falls back to the
   * active next-intl locale (which is what the marketing nav toggle drives).
   */
  targetLanguage?: SegmentLocale;
  variant?: 'desktop' | 'mobile';
  isStreamMuted?: boolean;
  onToggleStreamMute?: () => void;
}

const languageLabels: Record<string, string> = {
  en: 'English',
  nl: 'Nederlands',
  ar: 'العربية',
  fr: 'Français',
  de: 'Deutsch',
};

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 120;
const FONT_STEP = 4;

const SUPPORTED_LOCALES = new Set<SegmentLocale>(['en', 'nl', 'de', 'fr', 'ar']);

export function MarketingTranslationPanel({
  segments,
  targetLanguage,
  variant = 'desktop',
  isStreamMuted,
  onToggleStreamMute,
}: MarketingTranslationPanelProps) {
  const activeLocale = useLocale();
  const t = useTranslations('marketing.translationPanel');
  // Resolve the target language: explicit prop wins, otherwise use the
  // active marketing locale, falling back to English when the locale isn't
  // one of the supported segment translation keys.
  const lang: SegmentLocale =
    targetLanguage ??
    (SUPPORTED_LOCALES.has(activeLocale as SegmentLocale)
      ? (activeLocale as SegmentLocale)
      : 'en');

  const scrollRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(variant === 'mobile' ? 22 : 50);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft} />
        <div className={styles.topBarRight} />
      </div>

      <div className={styles.translationList} ref={scrollRef}>
        {segments.length === 0 ? (
          <div
            className={styles.emptyState}
            style={
              variant === 'mobile'
                ? { padding: '16px 16px 20px', gap: 0 }
                : undefined
            }
          >
            <div
              className={styles.emptyIcon}
              style={variant === 'mobile' ? { marginBottom: 8 } : undefined}
            >
              <LottieIcon
                src="/lottie/translate-icon.lottie"
                size={variant === 'mobile' ? 160 : 400}
              />
            </div>
            <div
              className={styles.emptyTitle}
              style={variant === 'mobile' ? { fontSize: 15, marginBottom: 4 } : undefined}
            >
              {t('emptyTitle')}
            </div>
            <div
              className={styles.emptyDescription}
              style={
                variant === 'mobile'
                  ? { fontSize: 12, marginBottom: 12, maxWidth: 220, lineHeight: 1.4 }
                  : undefined
              }
            >
              {t('emptyDescription')}
            </div>
            <div
              className={styles.languageIndicator}
              style={variant === 'mobile' ? { padding: '6px 12px', fontSize: 11 } : undefined}
            >
              <span className={styles.languageLabel}>{t('translatingTo')}</span>
              <span>{languageLabels[lang] ?? lang.toUpperCase()}</span>
            </div>
          </div>
        ) : (
          segments.map((segment, i) => {
            const isLatest = i === segments.length - 1;
            // Locale lookup with English fallback so an unsupported locale
            // gracefully degrades instead of rendering blank.
            const text = segment.translations[lang] ?? segment.translations.en;
            return (
              <div
                key={segment.id}
                className={`${styles.translationItem} ${isLatest ? styles.latest : ''}`}
              >
                <div className={styles.translationText} style={{ fontSize: `${fontSize}px` }}>
                  {text}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.bottomBarLeft} />
        <div
          className={styles.bottomBarRight}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          {onToggleStreamMute &&
            (isStreamMuted ? (
              <div className="relative inline-flex">
                {[0, 1].map((i) => (
                  <motion.span
                    key={i}
                    aria-hidden
                    initial={{ scale: 1, opacity: 0 }}
                    animate={{ scale: 2.4, opacity: [0.55, 0] }}
                    transition={{
                      duration: 2,
                      delay: i * 1,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 9999,
                      backgroundColor: 'var(--mkt-accent, #ff4d4d)',
                      pointerEvents: 'none',
                      transformOrigin: 'center',
                      willChange: 'transform, opacity',
                    }}
                  />
                ))}
                <button
                  type="button"
                  onClick={onToggleStreamMute}
                  aria-label={t('unmuteAria')}
                  title={t('tapToHearTitle')}
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 9999,
                    backgroundColor: 'var(--mkt-accent, #ff4d4d)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(255, 77, 77, 0.45)',
                  }}
                >
                  <VolumeOff style={{ width: 16, height: 16 }} />
                  {t('tapToHear')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onToggleStreamMute}
                aria-label={t('muteAria')}
                title={t('muteTitle')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 9999,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <Volume2 style={{ width: 16, height: 16 }} />
                {t('mute')}
              </button>
            ))}
          <div className={styles.fontControls}>
            <button
              type="button"
              onClick={() => setFontSize((p) => Math.max(MIN_FONT_SIZE, p - FONT_STEP))}
              disabled={fontSize <= MIN_FONT_SIZE}
              className={styles.fontButton}
              title={t('decreaseFontSize')}
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize((p) => Math.min(MAX_FONT_SIZE, p + FONT_STEP))}
              disabled={fontSize >= MAX_FONT_SIZE}
              className={styles.fontButton}
              title={t('increaseFontSize')}
            >
              A+
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
