'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

const linkGroups = [
  {
    titleKey: 'product',
    links: [
      { href: '#features', key: 'features' },
      { href: '#how-it-works', key: 'howItWorks' },
      { href: '#pricing', key: 'pricing' },
      { href: '/login', key: 'login' },
    ],
  },
  {
    titleKey: 'community',
    links: [
      { href: '#use-cases', key: 'useCases' },
      { href: 'mailto:hello@bayaan.ai', key: 'contact' },
      { href: '/donate', key: 'donate' },
    ],
  },
  {
    titleKey: 'company',
    links: [
      { href: 'mailto:hello@bayaan.ai', key: 'email' },
      { href: '/legal/privacy', key: 'privacy' },
      { href: '/legal/terms', key: 'terms' },
    ],
  },
] as const;

export function MarketingFooter() {
  const t = useTranslations('marketing.footer');
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-24 border-t"
      style={{
        background: 'var(--mkt-bg-sunken)',
        borderColor: 'var(--mkt-border)',
        color: 'var(--mkt-fg-muted)',
      }}
    >
      <div className="mkt-container py-14">
        <div className="grid gap-12 md:grid-cols-[minmax(0,_1.4fr)_minmax(0,_2fr)]">
          <div>
            <span
              className="text-[22px] font-bold tracking-tight"
              style={{ color: 'var(--mkt-fg)', letterSpacing: '-0.03em' }}
            >
              bayaan<span style={{ color: 'var(--mkt-brand)' }}>.ai</span>
            </span>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed">{t('tagline')}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
            {linkGroups.map((group) => (
              <div key={group.titleKey}>
                <h3
                  className="text-[12px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--mkt-fg)' }}
                >
                  {t(`groups.${group.titleKey}`)}
                </h3>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.key}>
                      <Link
                        href={link.href}
                        className="mkt-focus-ring text-[14px] transition-colors"
                        style={{ color: 'var(--mkt-fg-muted)' }}
                      >
                        {t(`links.${link.key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-12 flex flex-col items-start justify-between gap-3 border-t pt-6 text-[13px] md:flex-row md:items-center"
          style={{ borderColor: 'var(--mkt-border)' }}
        >
          <p>© {year} bayaan.ai. {t('copyright')}</p>
          <p style={{ color: 'var(--mkt-fg-subtle)' }}>{t('madeWith')}</p>
        </div>
      </div>
    </footer>
  );
}
