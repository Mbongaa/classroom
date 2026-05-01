'use client';

import { useTranslations } from 'next-intl';
import { CalendarHeart, BookOpenText, Megaphone, GraduationCap } from 'lucide-react';

const cases = [
  { key: 'khutbah', icon: CalendarHeart },
  { key: 'lessons', icon: BookOpenText },
  { key: 'community', icon: Megaphone },
  { key: 'classes', icon: GraduationCap },
];

export default function UseCasesMobile() {
  const t = useTranslations('marketing.useCases');

  return (
    <section id="use-cases" className="mkt-section" style={{ paddingBlock: '3.5rem' }}>
      <div className="mkt-container">
        <span className="mkt-eyebrow">{t('eyebrow')}</span>
        <h2 className="mkt-h2 mt-2" style={{ fontSize: 'clamp(1.625rem, 7vw, 2rem)' }}>
          {t('title')}
        </h2>
        <p className="mkt-lead mt-3" style={{ fontSize: '1rem' }}>
          {t('lead')}
        </p>

        <ul className="mt-8 space-y-4">
          {cases.map((c, i) => {
            const Icon = c.icon;
            const isFeatured = i === 0;
            return (
              <li
                key={c.key}
                className="mkt-card flex flex-col"
                style={
                  isFeatured
                    ? {
                        background: 'var(--mkt-brand-deep)',
                        color: 'var(--mkt-bg-elev)',
                        borderColor: 'var(--mkt-brand-deep)',
                      }
                    : undefined
                }
              >
                <div
                  className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={
                    isFeatured
                      ? { background: 'oklch(0.50 0.10 165)', color: 'var(--mkt-bg)' }
                      : { background: 'var(--mkt-brand-soft)', color: 'var(--mkt-brand-deep)' }
                  }
                >
                  <Icon size={20} aria-hidden />
                </div>
                <h3
                  className="mkt-h3"
                  style={
                    isFeatured
                      ? { color: 'var(--mkt-bg-elev)', fontSize: '1.125rem' }
                      : { fontSize: '1.125rem' }
                  }
                >
                  {t(`cases.${c.key}.title`)}
                </h3>
                <p
                  className="mt-2 leading-relaxed"
                  style={{
                    color: isFeatured ? 'oklch(0.92 0.04 165)' : 'var(--mkt-fg-muted)',
                    fontSize: '0.92rem',
                  }}
                >
                  {t(`cases.${c.key}.body`)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
