'use client';

import { useTranslations } from 'next-intl';
import { UserPlus, Plus, Radio, Monitor } from 'lucide-react';
import {
  StickyTag,
  SquigglyLine,
  PaperUnderline,
} from '@/components/marketing/sketch';

const steps = [
  { key: 'account', icon: UserPlus, rotate: -1.5 },
  { key: 'room', icon: Plus, rotate: 1 },
  { key: 'golive', icon: Radio, rotate: -0.8 },
  { key: 'display', icon: Monitor, rotate: 1.2 },
] as const;

export default function HowItWorks() {
  const t = useTranslations('marketing.howItWorks');

  return (
    <section id="how-it-works" className="mkt-section">
      <div className="mkt-container">
        <div className="mx-auto max-w-2xl text-center md:mx-0 md:text-left">
          <StickyTag rotate={-2} tone="postit">
            {t('eyebrow')}
          </StickyTag>
          <h2 className="mkt-h2 mt-6 relative inline-block">
            {t('title')}
            <PaperUnderline
              width="60%"
              color="var(--mkt-accent)"
              style={{
                position: 'absolute',
                left: 0,
                bottom: -4,
                width: '60%',
              }}
            />
          </h2>
          <p className="mkt-lead mt-6 mx-auto md:mx-0">{t('lead')}</p>
        </div>

        <ol
          className="relative mt-12 grid gap-x-10 gap-y-10 md:mt-20 md:gap-y-20 md:grid-cols-2 lg:grid-cols-4"
          aria-label="Setup steps"
        >
          {/* Squiggly connector — desktop only, sits behind the step circles */}
          <SquigglyLine
            className="pointer-events-none absolute left-[6%] right-[6%] top-9 hidden lg:block"
            color="var(--mkt-border)"
            width={1100}
            height={48}
            style={{
              width: '88%',
              height: 48,
              opacity: 0.55,
            }}
          />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.key}
                className="relative grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 md:flex md:flex-col md:gap-0"
                style={{ transform: `rotate(${step.rotate}deg)` }}
              >
                {/* Numbered rough circle marker — smaller on mobile */}
                <div className="relative md:flex md:items-center md:gap-4">
                  <div
                    className="relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center md:h-20 md:w-20"
                    style={{
                      background: 'var(--mkt-bg-elev)',
                      border: '3px solid var(--mkt-border)',
                      borderRadius: 'var(--mkt-wobbly-blob-1)',
                      boxShadow: '4px 4px 0 0 var(--mkt-border)',
                      fontFamily: 'var(--mkt-font-display)',
                      fontWeight: 700,
                      color: 'var(--mkt-fg)',
                    }}
                  >
                    <span
                      style={{ position: 'relative', zIndex: 1, fontSize: '1.5rem' }}
                      className="md:!text-[2rem]"
                    >
                      {i + 1}
                    </span>
                    <Icon
                      size={16}
                      strokeWidth={2.6}
                      aria-hidden
                      style={{
                        position: 'absolute',
                        bottom: -6,
                        right: -6,
                        background: 'var(--mkt-postit)',
                        border: '2px solid var(--mkt-border)',
                        borderRadius: '50%',
                        padding: 5,
                        width: 26,
                        height: 26,
                        boxShadow: '2px 2px 0 0 var(--mkt-border)',
                        color: 'var(--mkt-fg)',
                      }}
                    />
                  </div>
                </div>

                {/* Title + body. On mobile, sits to the right of the marker;
                    on desktop, drops below it. */}
                <div className="md:contents">
                  <h3
                    className="mkt-h3 self-center md:mt-7 md:self-auto"
                    style={{ fontSize: '1.25rem' }}
                  >
                    {t(`steps.${step.key}.title`)}
                  </h3>
                  <p
                    className="col-span-2 md:col-span-1 md:mt-3"
                    style={{
                      fontFamily: 'var(--mkt-font-body)',
                      color: 'var(--mkt-fg-muted)',
                      fontSize: '1rem',
                      lineHeight: 1.55,
                    }}
                  >
                    {t(`steps.${step.key}.body`)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

