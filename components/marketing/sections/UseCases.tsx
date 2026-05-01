'use client';

import { useTranslations } from 'next-intl';
import { CalendarHeart, BookOpenText, Megaphone, GraduationCap } from 'lucide-react';

const cases = [
  { key: 'khutbah', icon: CalendarHeart },
  { key: 'lessons', icon: BookOpenText },
  { key: 'community', icon: Megaphone },
  { key: 'classes', icon: GraduationCap },
];

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

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {cases.map((c, i) => {
            const Icon = c.icon;
            const isFeatured = i === 0;
            return (
              <article
                key={c.key}
                className="mkt-card flex flex-col"
                style={
                  isFeatured
                    ? {
                        background: 'var(--mkt-brand-deep)',
                        color: 'var(--mkt-bg-elev)',
                        borderColor: 'var(--mkt-brand-deep)',
                        minHeight: 280,
                      }
                    : { minHeight: 220 }
                }
              >
                <div
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={
                    isFeatured
                      ? { background: 'oklch(0.50 0.10 165)', color: 'var(--mkt-bg)' }
                      : { background: 'var(--mkt-brand-soft)', color: 'var(--mkt-brand-deep)' }
                  }
                >
                  <Icon size={22} aria-hidden />
                </div>
                <h3
                  className="mkt-h3"
                  style={isFeatured ? { color: 'var(--mkt-bg-elev)' } : undefined}
                >
                  {t(`cases.${c.key}.title`)}
                </h3>
                <p
                  className="mt-2 leading-relaxed"
                  style={{
                    color: isFeatured ? 'oklch(0.92 0.04 165)' : 'var(--mkt-fg-muted)',
                    fontSize: '0.95rem',
                  }}
                >
                  {t(`cases.${c.key}.body`)}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
