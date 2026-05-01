'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

const tiers = [
  {
    key: 'starter',
    featured: false,
    features: ['rooms', 'languages', 'recordings', 'support'],
    cta: { href: '/signup', key: 'cta.start' },
  },
  {
    key: 'pro',
    featured: true,
    features: ['rooms', 'languages', 'recordings', 'analytics', 'publicDisplay', 'support'],
    cta: { href: '/signup', key: 'cta.start' },
  },
  {
    key: 'enterprise',
    featured: false,
    features: ['unlimited', 'sso', 'sla', 'custom', 'support'],
    cta: { href: 'mailto:hello@bayaan.ai', key: 'cta.contact' },
  },
];

export default function Pricing() {
  const t = useTranslations('marketing.pricing');

  return (
    <section
      id="pricing"
      className="mkt-section"
      style={{ background: 'var(--mkt-bg-sunken)' }}
    >
      <div className="mkt-container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mkt-eyebrow">{t('eyebrow')}</span>
          <h2 className="mkt-h2 mt-3">{t('title')}</h2>
          <p className="mkt-lead mt-4 mx-auto" style={{ marginInline: 'auto' }}>
            {t('lead')}
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => {
            const featured = tier.featured;
            return (
              <article
                key={tier.key}
                className="mkt-card relative flex flex-col"
                style={
                  featured
                    ? {
                        background: 'var(--mkt-bg-elev)',
                        borderColor: 'var(--mkt-brand)',
                        borderWidth: 2,
                      }
                    : undefined
                }
              >
                {featured && (
                  <span
                    className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
                    style={{
                      background: 'var(--mkt-brand)',
                      color: 'oklch(0.99 0.005 165)',
                    }}
                  >
                    {t('badge')}
                  </span>
                )}

                <h3
                  className="text-[15px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--mkt-fg-subtle)' }}
                >
                  {t(`tiers.${tier.key}.name`)}
                </h3>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span
                    className="text-[44px] font-bold tracking-tight"
                    style={{ color: 'var(--mkt-fg)', letterSpacing: '-0.03em' }}
                  >
                    {t(`tiers.${tier.key}.price`)}
                  </span>
                  <span
                    className="text-[14px] font-medium"
                    style={{ color: 'var(--mkt-fg-muted)' }}
                  >
                    {t(`tiers.${tier.key}.period`)}
                  </span>
                </div>

                <p
                  className="mt-3 text-[14px] leading-relaxed"
                  style={{ color: 'var(--mkt-fg-muted)' }}
                >
                  {t(`tiers.${tier.key}.summary`)}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check
                        size={16}
                        className="mt-0.5 flex-shrink-0"
                        style={{ color: 'var(--mkt-brand)' }}
                        aria-hidden
                      />
                      <span
                        className="text-[14.5px] leading-relaxed"
                        style={{ color: 'var(--mkt-fg)' }}
                      >
                        {t(`tiers.${tier.key}.features.${f}`)}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.cta.href}
                  className="mkt-focus-ring mt-7 inline-flex h-11 items-center justify-center rounded-full text-[14.5px] font-semibold"
                  style={
                    featured
                      ? {
                          background: 'var(--mkt-brand)',
                          color: 'oklch(0.99 0.005 165)',
                        }
                      : {
                          color: 'var(--mkt-fg)',
                          border: '1px solid var(--mkt-border-strong)',
                        }
                  }
                >
                  {t(tier.cta.key)}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
