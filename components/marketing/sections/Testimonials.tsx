'use client';

import { useTranslations } from 'next-intl';

const items = [
  { key: 'ahmad' },
  { key: 'mamdouh' },
  { key: 'yusuf' },
] as const;

export default function Testimonials() {
  const t = useTranslations('marketing.testimonials');

  return (
    <section id="testimonials" className="mkt-section">
      <div className="mkt-container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mkt-h2">{t('title')}</h2>
          <p className="mkt-lead mt-4 mx-auto" style={{ marginInline: 'auto' }}>
            {t('lead')}
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3 md:gap-7">
          {items.map((item, i) => {
            const isFeatured = i === 1;
            return (
              <article
                key={item.key}
                className="mkt-card relative flex flex-col"
                style={
                  isFeatured
                    ? {
                        background: 'var(--mkt-bg-elev)',
                        borderColor: 'var(--mkt-brand)',
                        borderWidth: 1.5,
                        // Lift the middle card visually
                        transform: 'translateY(-8px)',
                        boxShadow:
                          '0 1px 1px oklch(0.20 0.02 200 / 0.04), 0 12px 32px oklch(0.20 0.02 200 / 0.10)',
                      }
                    : undefined
                }
              >
                {/* Quotation mark ornament */}
                <span
                  aria-hidden
                  className="select-none"
                  style={{
                    fontFamily: 'Poppins, system-ui, sans-serif',
                    fontSize: '4rem',
                    lineHeight: 0.6,
                    fontWeight: 800,
                    color: 'var(--mkt-brand-soft)',
                    marginBottom: '0.5rem',
                  }}
                >
                  “
                </span>

                {/* The quote */}
                <p
                  className="leading-relaxed"
                  style={{
                    color: 'var(--mkt-fg)',
                    fontSize: '1rem',
                    lineHeight: 1.6,
                  }}
                >
                  {t(`items.${item.key}.quote`)}
                </p>

                {/* Attribution — fixed to bottom of card */}
                <div
                  className="mt-7 border-t pt-5"
                  style={{ borderColor: 'var(--mkt-border)' }}
                >
                  <div
                    className="font-semibold"
                    style={{
                      color: 'var(--mkt-fg)',
                      fontSize: '0.95rem',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {t(`items.${item.key}.name`)}
                  </div>
                  <div
                    className="mt-0.5"
                    style={{ color: 'var(--mkt-fg-muted)', fontSize: '0.85rem' }}
                  >
                    {t(`items.${item.key}.role`)}
                  </div>
                  <div
                    className="mt-1"
                    style={{ color: 'var(--mkt-fg-subtle)', fontSize: '0.8rem' }}
                  >
                    {t(`items.${item.key}.location`)}
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
