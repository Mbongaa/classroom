'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

const points = ['noCard', 'instant', 'setup'];

export default function CTAMobile() {
  const t = useTranslations('marketing.cta');

  return (
    <section className="mkt-section" style={{ paddingBlock: '3.5rem' }}>
      <div className="mkt-container">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'var(--mkt-brand-deep)',
            color: 'oklch(0.96 0.02 165)',
            padding: '2rem 1.5rem',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              background:
                'radial-gradient(circle at 20% 30%, oklch(0.78 0.12 80 / 0.4), transparent 55%), radial-gradient(circle at 80% 80%, oklch(0.50 0.11 165 / 0.7), transparent 60%)',
            }}
          />

          <div className="relative">
            <h2
              className="mkt-h2"
              style={{
                color: 'oklch(0.99 0.005 165)',
                fontSize: 'clamp(1.625rem, 8vw, 2rem)',
              }}
            >
              {t('title')}
            </h2>
            <p
              className="mt-3 leading-relaxed"
              style={{ color: 'oklch(0.92 0.04 165)', fontSize: '0.98rem' }}
            >
              {t('lead')}
            </p>

            <ul className="mt-5 space-y-2.5">
              {points.map((p) => (
                <li key={p} className="flex items-center gap-2 text-[13.5px]">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{
                      background: 'oklch(0.50 0.11 165)',
                      color: 'oklch(0.99 0.005 165)',
                    }}
                  >
                    <Check size={12} aria-hidden />
                  </span>
                  <span style={{ color: 'oklch(0.92 0.04 165)' }}>{t(`points.${p}`)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/signup"
                className="mkt-focus-ring inline-flex h-12 items-center justify-center rounded-full text-[15px] font-semibold"
                style={{
                  background: 'oklch(0.99 0.005 165)',
                  color: 'var(--mkt-brand-deep)',
                }}
              >
                {t('ctaPrimary')}
              </Link>
              <Link
                href="mailto:hello@bayaan.ai"
                className="mkt-focus-ring inline-flex h-11 items-center justify-center rounded-full text-[14px] font-medium"
                style={{
                  color: 'oklch(0.96 0.02 165)',
                  border: '1px solid oklch(0.50 0.11 165)',
                }}
              >
                {t('ctaSecondary')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
