'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

const points = ['noCard', 'instant', 'setup'];

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
            background: 'var(--mkt-brand-deep)',
            color: 'oklch(0.96 0.02 165)',
            padding: 'clamp(2.5rem, 5vw, 4rem)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              background:
                'radial-gradient(circle at 20% 30%, oklch(0.78 0.12 80 / 0.4), transparent 55%), radial-gradient(circle at 80% 80%, oklch(0.50 0.11 165 / 0.7), transparent 60%)',
            }}
          />

          <div className="relative grid items-center gap-8 md:grid-cols-[minmax(0,_1.4fr)_minmax(0,_1fr)] md:gap-12">
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
                  <li key={p} className="flex items-center gap-2 text-[14.5px]">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{
                        background: 'oklch(0.50 0.11 165)',
                        color: 'oklch(0.99 0.005 165)',
                      }}
                    >
                      <Check size={12} aria-hidden />
                    </span>
                    <span style={{ color: 'oklch(0.92 0.04 165)' }}>{t(`points.${p}`)}</span>
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
                href="mailto:hello@bayaan.ai"
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
        </div>
      </div>
    </section>
  );
}
