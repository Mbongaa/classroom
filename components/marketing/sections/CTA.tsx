'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

const points = ['noCard', 'instant', 'setup'] as const;

export default function CTA() {
  const t = useTranslations('marketing.cta');

  return (
    <section
      className="mkt-section"
      style={{
        paddingTop: 'clamp(4rem, 8vw, 7rem)',
        paddingBottom: 'clamp(4rem, 8vw, 7rem)',
      }}
    >
      <div className="mkt-container">
        <div
          className="relative overflow-hidden rounded-3xl"
          style={{
            background:
              'linear-gradient(135deg, var(--mkt-brand-deep), var(--mkt-brand))',
            color: 'oklch(0.96 0.02 165)',
            padding: 'clamp(2.75rem, 5vw, 4.5rem)',
          }}
        >
          {/* Soft radial accents — gold in upper-left, deeper green in lower-right */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background:
                'radial-gradient(circle at 18% 22%, oklch(0.78 0.12 80 / 0.45), transparent 55%), radial-gradient(circle at 82% 78%, oklch(0.30 0.09 170 / 0.7), transparent 60%)',
            }}
          />

          <div className="relative grid items-center gap-10 md:grid-cols-[minmax(0,_1.45fr)_minmax(0,_1fr)] md:gap-14">
            <div>
              <h2
                className="mkt-h2"
                style={{
                  color: 'oklch(0.99 0.005 165)',
                  fontSize: 'clamp(1.875rem, 4.5vw, 3.25rem)',
                }}
              >
                {t('title')}
              </h2>
              <p
                className="mt-4 leading-relaxed"
                style={{
                  color: 'oklch(0.92 0.04 165)',
                  fontSize: '1.0625rem',
                  maxWidth: '32rem',
                }}
              >
                {t('lead')}
              </p>

              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
                {points.map((p) => (
                  <li
                    key={p}
                    className="flex items-center gap-2 text-[14.5px]"
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{
                        background: 'oklch(0.50 0.11 165)',
                        color: 'oklch(0.99 0.005 165)',
                      }}
                    >
                      <Check size={12} aria-hidden />
                    </span>
                    <span style={{ color: 'oklch(0.92 0.04 165)' }}>
                      {t(`points.${p}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <Link
                href="/signup"
                className="mkt-focus-ring inline-flex h-12 items-center justify-center rounded-full px-7 text-[15px] font-semibold"
                style={{
                  background: 'oklch(0.99 0.005 165)',
                  color: 'var(--mkt-brand-deep)',
                }}
              >
                {t('ctaPrimary')}
                <ArrowRight size={16} className="ml-2" aria-hidden />
              </Link>
              <Link
                href="mailto:support@bayaan.ai"
                className="mkt-focus-ring inline-flex h-12 items-center justify-center rounded-full px-6 text-[14.5px] font-medium"
                style={{
                  color: 'oklch(0.96 0.02 165)',
                  border: '1px solid oklch(0.50 0.11 165)',
                }}
              >
                {t('ctaSecondary')}
              </Link>
            </div>
          </div>

          {/* Closing baraka — Arabic + transliteration. Centered, soft. */}
          <div
            className="relative mt-12 border-t pt-8 text-center"
            style={{
              borderColor: 'oklch(0.50 0.11 165 / 0.4)',
            }}
          >
            <p
              lang="ar"
              dir="rtl"
              className="font-arabic"
              style={{
                fontFamily: "'Noto Sans Arabic', system-ui, sans-serif",
                color: 'oklch(0.99 0.005 165)',
                fontSize: 'clamp(1.25rem, 2.4vw, 1.75rem)',
                fontWeight: 500,
                letterSpacing: '0.01em',
              }}
            >
              {t('blessing.arabic')}
            </p>
            <p
              className="mt-2"
              style={{
                color: 'oklch(0.85 0.05 165)',
                fontSize: '0.9rem',
                fontStyle: 'italic',
              }}
            >
              {t('blessing.translation')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
