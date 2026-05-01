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

export default function PricingMobile() {
  const t = useTranslations('marketing.pricing');

  return (
    <section
      id="pricing"
      className="mkt-section"
      style={{ background: 'var(--mkt-bg-sunken)', paddingBlock: '3.5rem' }}
    >
      <div className="mkt-container">
        <span className="mkt-eyebrow">{t('eyebrow')}</span>
        <h2 className="mkt-h2 mt-2" style={{ fontSize: 'clamp(1.625rem, 7vw, 2rem)' }}>
          {t('title')}
        </h2>
        <p className="mkt-lead mt-3" style={{ fontSize: '1rem' }}>
          {t('lead')}
        </p>

        <ul className="mt-8 space-y-5">
          {tiers.map((tier) => {
            const featured = tier.featured;
            return (
              <li
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
                    className="absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: 'var(--mkt-brand)',
                      color: 'oklch(0.99 0.005 165)',
                    }}
                  >
                    {t('badge')}
                  </span>
                )}

                <h3
                  className="text-[14px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--mkt-fg-subtle)' }}
                >
                  {t(`tiers.${tier.key}.name`)}
                </h3>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span
                    className="text-[36px] font-bold tracking-tight"
                    style={{ color: 'var(--mkt-fg)', letterSpacing: '-0.03em' }}
                  >
                    {t(`tiers.${tier.key}.price`)}
                  </span>
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: 'var(--mkt-fg-muted)' }}
                  >
                    {t(`tiers.${tier.key}.period`)}
                  </span>
                </div>

                <p
                  className="mt-2 text-[13.5px] leading-relaxed"
                  style={{ color: 'var(--mkt-fg-muted)' }}
                >
                  {t(`tiers.${tier.key}.summary`)}
                </p>

                <ul className="mt-5 space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check
                        size={15}
                        className="mt-0.5 flex-shrink-0"
                        style={{ color: 'var(--mkt-brand)' }}
                        aria-hidden
                      />
                      <span
                        className="text-[13.5px] leading-relaxed"
                        style={{ color: 'var(--mkt-fg)' }}
                      >
                        {t(`tiers.${tier.key}.features.${f}`)}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.cta.href}
                  className="mkt-focus-ring mt-6 inline-flex h-11 items-center justify-center rounded-full text-[14px] font-semibold"
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
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
