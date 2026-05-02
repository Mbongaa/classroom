'use client';

import { useTranslations } from 'next-intl';
import { CalendarHeart, BookOpenText, Heart, Megaphone } from 'lucide-react';
import {
  SketchCard,
  StickyTag,
  ScribbleCircle,
} from '@/components/marketing/sketch';

const cases = [
  {
    key: 'khutbah',
    icon: CalendarHeart,
    rotate: -1.8,
    decoration: 'tape' as const,
    tone: 'paper' as const,
  },
  {
    key: 'education',
    icon: BookOpenText,
    rotate: 1.5,
    decoration: 'tack' as const,
    tone: 'postit' as const,
  },
  {
    key: 'community',
    icon: Heart,
    rotate: -1.2,
    decoration: 'tack-blue' as const,
    tone: 'paper' as const,
  },
  {
    key: 'dawah',
    icon: Megaphone,
    rotate: 2,
    decoration: 'tape-double' as const,
    tone: 'paper' as const,
  },
] as const;

export default function UseCases() {
  const t = useTranslations('marketing.useCases');

  return (
    <section
      id="use-cases"
      className="mkt-section"
      style={{ background: 'var(--mkt-bg-sunken)' }}
    >
      <div className="mkt-container">
        <div className="grid items-end gap-8 md:grid-cols-2 md:gap-12">
          <div>
            <StickyTag rotate={-2} tone="paper">
              {t('eyebrow')}
            </StickyTag>
            <h2 className="mkt-h2 mt-6">{t('title')}</h2>
          </div>
          <p className="mkt-lead">{t('lead')}</p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 md:gap-10">
          {cases.map((c) => {
            const Icon = c.icon;
            const chips = t.raw(`cases.${c.key}.chips`) as string[];
            return (
              <SketchCard
                key={c.key}
                tone={c.tone}
                decoration={c.decoration}
                rotate={c.rotate}
                hoverJiggle
                radiusVariant={c.tone === 'postit' ? 'b' : 'a'}
                style={{
                  paddingTop: c.decoration === 'tack' || c.decoration === 'tack-blue' ? '2.5rem' : undefined,
                  minHeight: 280,
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Icon enclosed in a hand-drawn scribble ring */}
                  <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center">
                    <ScribbleCircle
                      size={64}
                      color="var(--mkt-fg)"
                      strokeWidth={2.4}
                      style={{ position: 'absolute', inset: 0 }}
                    />
                    <Icon
                      size={26}
                      strokeWidth={2.6}
                      aria-hidden
                      style={{ color: 'var(--mkt-fg)', position: 'relative' }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--mkt-font-body)',
                      fontSize: '0.85rem',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      background: 'var(--mkt-accent)',
                      color: 'var(--mkt-bg-elev)',
                      padding: '0.3rem 0.75rem',
                      border: '2px solid var(--mkt-border)',
                      borderRadius: '14px 4px 12px 6px / 6px 14px 4px 12px',
                      transform: 'rotate(2deg)',
                      boxShadow: '2px 2px 0 0 var(--mkt-border)',
                    }}
                  >
                    {t(`cases.${c.key}.tag`)}
                  </span>
                </div>

                <h3 className="mkt-h3 mt-6" style={{ fontSize: '1.55rem' }}>
                  {t(`cases.${c.key}.title`)}
                </h3>
                <p
                  className="mt-3"
                  style={{
                    fontFamily: 'var(--mkt-font-body)',
                    color: 'var(--mkt-fg-muted)',
                    fontSize: '1.05rem',
                    lineHeight: 1.6,
                  }}
                >
                  {t(`cases.${c.key}.body`)}
                </p>

                <ul className="mt-6 flex flex-wrap gap-2 pt-2">
                  {chips.map((chip, i) => (
                    <li
                      key={chip}
                      style={{
                        fontFamily: 'var(--mkt-font-body)',
                        fontSize: '0.9rem',
                        background: 'var(--mkt-bg-elev)',
                        color: 'var(--mkt-fg)',
                        padding: '0.3rem 0.75rem',
                        border: '1.5px solid var(--mkt-border)',
                        borderRadius: 'var(--mkt-wobbly-pill)',
                        transform: `rotate(${[-1, 1, -0.5][i % 3]}deg)`,
                      }}
                    >
                      {chip}
                    </li>
                  ))}
                </ul>
              </SketchCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
