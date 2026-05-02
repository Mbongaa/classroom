'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { SketchCard, StickyTag } from '@/components/marketing/sketch';

const acts = [
  { key: 'challenge', tone: 'paper', rotate: -2.5, decoration: 'tape' },
  { key: 'realization', tone: 'postit', rotate: 1.8, decoration: 'tack' },
  { key: 'universal', tone: 'paper', rotate: -1.3, decoration: 'tack-blue' },
  { key: 'vision', tone: 'postit', rotate: 2.2, decoration: 'tape-double' },
] as const;

export default function Anecdote() {
  const t = useTranslations('marketing.anecdote');

  return (
    <section
      id="story"
      className="mkt-section relative overflow-hidden"
      style={{ background: 'var(--mkt-bg-sunken)' }}
    >
      <div className="mkt-container relative">
        <div className="max-w-2xl">
          <StickyTag rotate={2} tone="paper">
            {t('eyebrow')}
          </StickyTag>
          <h2
            className="mkt-h2 mt-6"
            style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4.25rem)' }}
          >
            {t('title')}
          </h2>
        </div>

        {/* Corkboard of sticky-note acts. Asymmetric layout breaks the grid. */}
        <div className="mt-16 grid gap-10 md:mt-24 md:grid-cols-12 md:gap-x-8 md:gap-y-16">
          {acts.map((act, i) => {
            // Asymmetric placement: alternate column position + width
            const placement = [
              'md:col-span-7 md:col-start-1', // act 1: left, wide
              'md:col-span-6 md:col-start-7', // act 2: right, medium
              'md:col-span-6 md:col-start-2', // act 3: left-of-center
              'md:col-span-7 md:col-start-6', // act 4: right, wide
            ][i];

            return (
              <div key={act.key} className={placement}>
                <SketchCard
                  tone={act.tone}
                  decoration={act.decoration}
                  rotate={act.rotate}
                  emphasized={i === 0 || i === 3}
                  radiusVariant={i % 2 === 0 ? 'a' : 'b'}
                  style={{
                    paddingTop: act.decoration.startsWith('tack')
                      ? '2.5rem'
                      : undefined,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--mkt-font-body)',
                      fontSize: '0.85rem',
                      letterSpacing: '0.2em',
                      // accent-deep (~4.5:1 on cream) instead of accent (3.6:1)
                      // so small uppercase labels meet WCAG AA contrast.
                      color: 'var(--mkt-accent-deep)',
                      textTransform: 'uppercase',
                      fontWeight: 400,
                    }}
                  >
                    <span
                      className="tabular-nums"
                      style={{ marginRight: '0.6rem', color: 'var(--mkt-fg-subtle)' }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {t(`acts.${act.key}.label`)}
                  </div>
                  <p
                    className="mt-4"
                    style={{
                      fontFamily: 'var(--mkt-font-body)',
                      color: 'var(--mkt-fg)',
                      fontSize: 'clamp(1.05rem, 1.4vw, 1.2rem)',
                      lineHeight: 1.65,
                    }}
                  >
                    {t(`acts.${act.key}.body`)}
                  </p>
                </SketchCard>
              </div>
            );
          })}
        </div>

        {/* Closing CTA — handwritten link, not a banner */}
        <div className="mt-20 flex">
          <Link
            href="/signup"
            className="mkt-focus-ring inline-flex items-center gap-2 group"
            style={{
              fontFamily: 'var(--mkt-font-display)',
              color: 'var(--mkt-fg)',
              fontSize: '1.4rem',
              fontWeight: 700,
              textDecoration: 'underline',
              textDecorationStyle: 'wavy',
              textDecorationColor: 'var(--mkt-accent)',
              textUnderlineOffset: '6px',
              textDecorationThickness: '2px',
            }}
          >
            <span>{t('cta')}</span>
            <ArrowRight
              size={22}
              strokeWidth={2.6}
              aria-hidden
              className="transition-transform duration-100 group-hover:translate-x-1"
              style={{ color: 'var(--mkt-accent)' }}
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
