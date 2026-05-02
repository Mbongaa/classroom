'use client';

import { useTranslations } from 'next-intl';
import { CalendarHeart, BookOpenText, Heart, Megaphone } from 'lucide-react';

const cases = [
  { key: 'khutbah', icon: CalendarHeart },
  { key: 'education', icon: BookOpenText },
  { key: 'community', icon: Heart },
  { key: 'dawah', icon: Megaphone },
] as const;

export default function UseCases() {
  const t = useTranslations('marketing.useCases');

  return (
    <section id="use-cases" className="mkt-section">
      <div className="mkt-container">
        <div className="grid items-end gap-8 md:grid-cols-2 md:gap-12">
          <div>
            <span className="mkt-eyebrow">{t('eyebrow')}</span>
            <h2 className="mkt-h2 mt-3">{t('title')}</h2>
          </div>
          <p className="mkt-lead">{t('lead')}</p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 md:gap-6">
          {cases.map((c, i) => {
            const Icon = c.icon;
            const isFeatured = i === 0;
            const chips = t.raw(`cases.${c.key}.chips`) as string[];
            return (
              <article
                key={c.key}
                className="mkt-card flex flex-col"
                style={
                  isFeatured
                    ? {
                        background: 'var(--mkt-brand-deep)',
                        color: 'oklch(0.96 0.02 165)',
                        borderColor: 'var(--mkt-brand-deep)',
                        minHeight: 280,
                      }
                    : { minHeight: 240 }
                }
              >
                {/* Header row: icon + tag chip */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                    style={
                      isFeatured
                        ? {
                            background: 'oklch(0.50 0.10 165)',
                            color: 'oklch(0.99 0.005 165)',
                          }
                        : {
                            background: 'var(--mkt-brand-soft)',
                            color: 'var(--mkt-brand-deep)',
                          }
                    }
                  >
                    <Icon size={22} aria-hidden />
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase"
                    style={
                      isFeatured
                        ? {
                            background: 'oklch(0.50 0.10 165 / 0.55)',
                            color: 'oklch(0.99 0.005 165)',
                            letterSpacing: '0.12em',
                          }
                        : {
                            background: 'oklch(0.95 0.04 80)',
                            color: 'var(--mkt-accent-deep)',
                            letterSpacing: '0.12em',
                          }
                    }
                  >
                    {t(`cases.${c.key}.tag`)}
                  </span>
                </div>

                <h3
                  className="mkt-h3 mt-5"
                  style={isFeatured ? { color: 'oklch(0.99 0.005 165)' } : undefined}
                >
                  {t(`cases.${c.key}.title`)}
                </h3>
                <p
                  className="mt-2 leading-relaxed"
                  style={{
                    color: isFeatured
                      ? 'oklch(0.92 0.04 165)'
                      : 'var(--mkt-fg-muted)',
                    fontSize: '0.95rem',
                  }}
                >
                  {t(`cases.${c.key}.body`)}
                </p>

                {/* Chips */}
                <ul className="mt-auto flex flex-wrap gap-2 pt-6">
                  {chips.map((chip) => (
                    <li
                      key={chip}
                      className="rounded-full px-2.5 py-1"
                      style={
                        isFeatured
                          ? {
                              background: 'oklch(0.30 0.09 170)',
                              color: 'oklch(0.92 0.04 165)',
                              fontSize: '0.74rem',
                              fontWeight: 500,
                            }
                          : {
                              background: 'var(--mkt-bg-sunken)',
                              color: 'var(--mkt-fg-muted)',
                              fontSize: '0.74rem',
                              fontWeight: 500,
                              border: '1px solid var(--mkt-border)',
                            }
                      }
                    >
                      {chip}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
