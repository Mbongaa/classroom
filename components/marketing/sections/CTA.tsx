'use client';

import { ArrowRight, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SketchButton } from '@/components/marketing/sketch';

const points = ['instant', 'setup'] as const;

export default function CTA() {
  const t = useTranslations('marketing.cta');

  return (
    <section className="mkt-section">
      <div className="mkt-container">
        <div
          className="relative overflow-hidden"
          style={{
            background: 'var(--mkt-accent)',
            color: 'var(--mkt-bg-elev)',
            padding: 'clamp(2.75rem, 5vw, 4.5rem)',
            border: '3px solid var(--mkt-border)',
            borderRadius: 'var(--mkt-wobbly)',
            boxShadow: 'var(--mkt-shadow-card-strong)',
            transform: 'rotate(-0.5deg)',
          }}
        >
          {/* Subtle paper-texture overlay so the red doesn't read flat */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.18) 1px, transparent 0)',
              backgroundSize: '20px 20px',
            }}
          />

          <div className="relative grid items-center gap-10 md:grid-cols-[minmax(0,_1.45fr)_minmax(0,_1fr)] md:gap-14">
            <div>
              <h2
                style={{
                  fontFamily: 'var(--mkt-font-display)',
                  color: 'var(--mkt-bg-elev)',
                  fontSize: 'clamp(2rem, 5vw, 3.75rem)',
                  fontWeight: 700,
                  lineHeight: 1.05,
                }}
              >
                {t('title')}
              </h2>
              <p
                className="mt-5"
                style={{
                  fontFamily: 'var(--mkt-font-body)',
                  color: 'var(--mkt-bg-elev)',
                  opacity: 0.95,
                  fontSize: '1.2rem',
                  lineHeight: 1.55,
                  maxWidth: '34rem',
                }}
              >
                {t('lead')}
              </p>

              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
                {points.map((p) => (
                  <li
                    key={p}
                    className="flex items-center gap-2"
                    style={{
                      fontFamily: 'var(--mkt-font-body)',
                      fontSize: '1.05rem',
                    }}
                  >
                    <span
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center"
                      style={{
                        background: 'var(--mkt-bg-elev)',
                        color: 'var(--mkt-accent)',
                        border: '2px solid var(--mkt-border)',
                        borderRadius: 'var(--mkt-wobbly-blob-2)',
                      }}
                    >
                      <Check size={13} strokeWidth={3} aria-hidden />
                    </span>
                    <span style={{ color: 'var(--mkt-bg-elev)' }}>
                      {t(`points.${p}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-4 md:items-end">
              <SketchButton href="/signup" size="lg" variant="primary">
                {t('ctaPrimary')}
                <ArrowRight size={18} strokeWidth={2.6} aria-hidden />
              </SketchButton>
              <SketchButton
                href="mailto:support@bayaan.ai"
                size="md"
                variant="ghost"
                style={{
                  border: '3px solid rgba(253, 251, 247, 0.5)',
                  color: 'var(--mkt-bg-elev)',
                }}
              >
                {t('ctaSecondary')}
              </SketchButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
