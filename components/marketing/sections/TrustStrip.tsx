'use client';

import { useTranslations } from 'next-intl';

const cities = ['Eindhoven', 'Roermond', 'Maaseik', 'Antwerpen', 'Tilburg', 'Gent'];

export function TrustStrip() {
  const t = useTranslations('marketing.trust');

  return (
    <section
      aria-label={t('ariaLabel')}
      className="border-y"
      style={{
        background: 'var(--mkt-bg-elev)',
        borderColor: 'var(--mkt-border)',
        paddingBlock: '1.75rem',
      }}
    >
      <div className="mkt-container flex flex-col items-center gap-5 md:flex-row md:items-center md:justify-between">
        <p
          className="text-[12px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: 'var(--mkt-fg-subtle)' }}
        >
          {t('label')}
        </p>
        <ul
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
          aria-hidden
        >
          {cities.map((city) => (
            <li
              key={city}
              className="text-[15px] font-semibold tracking-tight"
              style={{ color: 'var(--mkt-fg-muted)' }}
            >
              {city}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
