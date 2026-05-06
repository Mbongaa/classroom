'use client';

import { useTranslations } from 'next-intl';
import { StickyTag } from '@/components/marketing/sketch';

const items = [
  { key: 'ahmad', rotate: -1.8, tone: 'paper' as const, initialBg: 'var(--mkt-postit)' },
  { key: 'mamdouh', rotate: 1.5, tone: 'paper' as const, initialBg: 'var(--mkt-accent-soft)' },
  { key: 'yusuf', rotate: -1, tone: 'paper' as const, initialBg: 'var(--mkt-secondary-soft)' },
] as const;

export default function Testimonials() {
  const t = useTranslations('marketing.testimonials');

  return (
    <section id="testimonials" className="mkt-section">
      <div className="mkt-container">
        <div className="mx-auto max-w-2xl text-center">
          <StickyTag rotate={2} tone="postit">
            {t('eyebrow')}
          </StickyTag>
          <h2 className="mkt-h2 mt-6">{t('title')}</h2>
          <p className="mkt-lead mt-6 mx-auto" style={{ marginInline: 'auto' }}>
            {t('lead')}
          </p>
        </div>

        <div className="mt-20 grid gap-10 md:grid-cols-3 md:gap-7">
          {items.map((item, i) => {
            const initial = (t(`items.${item.key}.name`) || '?')
              .replace(/[^a-zA-Z؀-ۿ]/g, '')
              .charAt(0)
              .toUpperCase();
            return (
              <article
                key={item.key}
                className="relative flex flex-col"
                style={{
                  transform: `rotate(${item.rotate}deg)`,
                  marginTop: i === 1 ? '-1.5rem' : 0,
                }}
              >
                {/* Speech bubble */}
                <div
                  className="relative"
                  style={{
                    background: 'var(--mkt-bg-elev)',
                    border: '2.5px solid var(--mkt-border)',
                    borderRadius: 'var(--mkt-wobbly)',
                    boxShadow: '6px 6px 0 0 var(--mkt-border)',
                    padding: 'clamp(1.5rem, 2.4vw, 2rem)',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--mkt-font-body)',
                      color: 'var(--mkt-fg)',
                      fontSize: '1.1rem',
                      lineHeight: 1.65,
                    }}
                  >
                    “{t(`items.${item.key}.quote`)}”
                  </p>

                  {/* Speech bubble tail — geometric triangle made of two
                      borders. Sits below the bubble pointing at the avatar. */}
                  <span
                    aria-hidden
                    className="absolute"
                    style={{
                      bottom: -22,
                      left: 36,
                      width: 0,
                      height: 0,
                      borderLeft: '20px solid transparent',
                      borderRight: '8px solid transparent',
                      borderTop: '24px solid var(--mkt-border)',
                    }}
                  />
                  <span
                    aria-hidden
                    className="absolute"
                    style={{
                      bottom: -19,
                      left: 39,
                      width: 0,
                      height: 0,
                      borderLeft: '16px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '20px solid var(--mkt-bg-elev)',
                    }}
                  />
                </div>

                {/* Attribution row — avatar circle + name */}
                <div className="mt-9 flex items-center gap-3 pl-4">
                  <span
                    aria-hidden
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center"
                    style={{
                      background: item.initialBg,
                      color: 'var(--mkt-fg)',
                      fontFamily: 'var(--mkt-font-display)',
                      fontSize: '1.4rem',
                      fontWeight: 700,
                      border: '2.5px solid var(--mkt-border)',
                      borderRadius: 'var(--mkt-wobbly-blob-2)',
                      boxShadow: '3px 3px 0 0 var(--mkt-border)',
                    }}
                  >
                    {initial}
                  </span>
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--mkt-font-display)',
                        color: 'var(--mkt-fg)',
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        lineHeight: 1.2,
                      }}
                    >
                      {t(`items.${item.key}.name`)}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--mkt-font-body)',
                        color: 'var(--mkt-fg-muted)',
                        fontSize: '0.95rem',
                        lineHeight: 1.3,
                      }}
                    >
                      {t(`items.${item.key}.role`)}{' · '}{t(`items.${item.key}.location`)}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
