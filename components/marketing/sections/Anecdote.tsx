'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

const acts = ['challenge', 'realization', 'universal', 'vision'] as const;

export default function Anecdote() {
  const t = useTranslations('marketing.anecdote');

  return (
    <section
      id="story"
      className="mkt-section relative overflow-hidden"
      style={{ background: 'var(--mkt-bg-sunken)' }}
    >
      {/* Decorative oversize quotation mark in the upper-left, anchoring the editorial register */}
      <span
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{
          top: '2.5rem',
          left: '-0.25rem',
          fontSize: 'clamp(12rem, 22vw, 22rem)',
          lineHeight: 1,
          fontFamily: 'Poppins, system-ui, sans-serif',
          fontWeight: 800,
          color: 'var(--mkt-brand)',
          opacity: 0.05,
          letterSpacing: '-0.06em',
        }}
      >
        “
      </span>

      <div className="mkt-container relative">
        <div className="max-w-2xl">
          <h2 className="mkt-h2">{t('title')}</h2>
        </div>

        <div className="mt-14 space-y-12 md:mt-20 md:space-y-20">
          {acts.map((act, i) => {
            const isOdd = i % 2 === 1;
            return (
              <article
                key={act}
                className="relative grid gap-6 md:grid-cols-12 md:items-start md:gap-10"
              >
                {/* Eyebrow label */}
                <div
                  className={`md:col-span-4 ${isOdd ? 'md:order-2 md:col-start-9' : ''}`}
                >
                  <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-4">
                    {/* Index ornament */}
                    <span
                      aria-hidden
                      className="font-semibold tabular-nums"
                      style={{
                        color: 'var(--mkt-accent-deep)',
                        fontSize: '0.95rem',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className="font-semibold uppercase"
                      style={{
                        color: 'var(--mkt-fg-subtle)',
                        fontSize: '0.7rem',
                        letterSpacing: '0.22em',
                      }}
                    >
                      {t(`acts.${act}.label`)}
                    </span>
                  </div>
                </div>

                {/* Body — long-form serif-feeling block */}
                <div
                  className={`md:col-span-8 ${isOdd ? 'md:order-1 md:col-start-1 md:row-start-1' : ''}`}
                >
                  <p
                    className="leading-relaxed"
                    style={{
                      color: 'var(--mkt-fg)',
                      fontSize: 'clamp(1.125rem, 1.6vw, 1.4rem)',
                      lineHeight: 1.6,
                      maxWidth: '38rem',
                      fontWeight: 400,
                    }}
                  >
                    {t(`acts.${act}.body`)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        {/* Closing CTA — quiet, not loud */}
        <div className="mt-16 flex md:mt-24">
          <Link
            href="/signup"
            className="mkt-focus-ring group inline-flex items-center gap-2 text-[15px] font-semibold"
            style={{ color: 'var(--mkt-brand)' }}
          >
            <span>{t('cta')}</span>
            <span
              aria-hidden
              className="inline-block transition-transform group-hover:translate-x-1"
              style={{ color: 'var(--mkt-accent-deep)' }}
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
