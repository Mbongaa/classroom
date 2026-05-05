'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import dynamic from 'next/dynamic';
import { IconHeartHandshake } from '@tabler/icons-react';
import { LottieIcon } from '@/components/lottie-icon';
import { getCampaignIcon } from '@/lib/campaign-icons';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false },
);

/**
 * Passive kiosk display. No touch — full-screen rotation through active
 * campaigns with a permanent QR pointing to the phone chooser at
 * /donate/[orgSlug].
 */

export interface KioskCampaign {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  cause_type: string | null;
  icon: string | null;
  raised_cents: number;
}

interface KioskDisplayClientProps {
  orgSlug: string;
  orgName: string;
  orgCity: string | null;
  orgCountry: string;
  orgDescription: string | null;
  campaigns: KioskCampaign[];
}

const ROTATION_INTERVAL_MS = 10_000;

function formatEuro(cents: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function KioskDisplayClient({
  orgSlug,
  orgName,
  orgCity,
  orgCountry,
  orgDescription,
  campaigns,
}: KioskDisplayClientProps) {
  const [index, setIndex] = useState(0);
  const [donateUrl, setDonateUrl] = useState<string>('');

  // Build the absolute QR target on the client so it picks up the actual
  // origin (works for subdomains like elfeth.bayaan.app).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDonateUrl(`${window.location.origin}/donate/${orgSlug}`);
  }, [orgSlug]);

  // Auto-rotate campaign focus.
  useEffect(() => {
    if (campaigns.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % campaigns.length);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [campaigns.length]);

  const current = campaigns[index] ?? null;
  const currentIcon = useMemo(() => getCampaignIcon(current?.icon), [current?.icon]);

  const hasGoal = current?.goal_amount != null && current.goal_amount > 0;
  const pct =
    hasGoal && current
      ? Math.min(100, Math.round((current.raised_cents / current.goal_amount!) * 100))
      : null;

  // Bottom Lottie progress bar — frame position reflects the focused campaign's
  // raised %. Animates forward when % increases, reverse when it decreases.
  const dotLottieRef = useRef<any>(null);
  const lottieLoadedRef = useRef(false);
  const currentFrameRef = useRef(0);

  const animateToPercentage = useCallback((p: number) => {
    const instance = dotLottieRef.current;
    if (!instance || !lottieLoadedRef.current) return;
    const total = instance.totalFrames;
    if (!total) return;
    const clamped = Math.max(0, Math.min(100, p));
    const targetFrame = Math.round((clamped / 100) * (total - 1));
    const fromFrame = currentFrameRef.current;
    if (fromFrame === targetFrame) return;
    currentFrameRef.current = targetFrame;
    if (fromFrame < targetFrame) {
      instance.setMode('forward');
      instance.setSegment(fromFrame, targetFrame);
    } else {
      instance.setMode('reverse');
      instance.setSegment(targetFrame, fromFrame);
    }
    instance.setSpeed(1.5);
    instance.play();
  }, []);

  const dotLottieRefCallback = useCallback(
    (instance: any) => {
      dotLottieRef.current = instance;
      if (instance) {
        instance.addEventListener('load', () => {
          lottieLoadedRef.current = true;
          animateToPercentage(pct ?? 0);
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    animateToPercentage(pct ?? 0);
  }, [pct, animateToPercentage]);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="shrink-0 border-b border-[rgba(128,128,128,0.15)] px-8 py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">{orgName}</h1>
            {orgCity && (
              <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                {orgCity}, {orgCountry}
              </p>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Powered by{' '}
            <a
              href="https://www.bayaan.app"
              className="underline underline-offset-4 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Bayaan
            </a>
          </p>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-8 px-8 py-8 md:flex-row md:items-stretch">
        {/* ---- Left: rotating campaign focus ---- */}
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          {campaigns.length === 0 ? (
            <div>
              <p className="text-2xl font-semibold">Support {orgName}</p>
              {orgDescription && (
                <p className="mt-3 max-w-xl text-base text-slate-500 dark:text-slate-400">
                  {orgDescription}
                </p>
              )}
              <p className="mt-6 text-sm text-slate-400">
                Scan the QR to become a monthly member.
              </p>
            </div>
          ) : (
            current && (
              <div
                key={current.id}
                className="flex w-full flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-700"
              >
                {currentIcon && (
                  <div aria-hidden="true" className="mb-6">
                    <LottieIcon src={currentIcon.file} size={220} />
                  </div>
                )}
                {current.cause_type && (
                  <span className="mb-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {current.cause_type}
                  </span>
                )}
                <h2 className="text-3xl font-bold sm:text-4xl">{current.title}</h2>
                {current.description && (
                  <p className="mt-3 max-w-xl text-base text-slate-600 dark:text-slate-300">
                    {current.description}
                  </p>
                )}
                {hasGoal && (
                  <div className="mt-6 w-full max-w-md">
                    <div className="mx-auto h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm">
                      <span className="font-semibold">
                        {formatEuro(current.raised_cents)}
                      </span>{' '}
                      <span className="text-slate-500 dark:text-slate-400">
                        of {formatEuro(current.goal_amount!)} &middot; {pct}%
                      </span>
                    </p>
                  </div>
                )}
                {/* Rotation indicator dots */}
                {campaigns.length > 1 && (
                  <div className="mt-8 flex items-center gap-1.5">
                    {campaigns.map((c, i) => (
                      <span
                        key={c.id}
                        className={`h-1.5 rounded-full transition-all ${
                          i === index
                            ? 'w-6 bg-emerald-500'
                            : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </section>

        {/* ---- Right: permanent QR + the two donor options ---- */}
        <section className="flex shrink-0 flex-col items-center justify-center md:w-[400px]">
          <div className="rounded-2xl border border-[rgba(128,128,128,0.2)] bg-white p-6 shadow-md">
            {donateUrl ? (
              <QRCodeSVG value={donateUrl} size={260} level="M" includeMargin={false} />
            ) : (
              <div className="h-[260px] w-[260px] animate-pulse rounded bg-slate-100" />
            )}
          </div>
          <p className="mt-5 text-center text-lg font-semibold">Scan to donate</p>

          {/* Two informational option cards (not clickable — kiosk is non-touch). */}
          <ul className="mt-5 w-full max-w-[340px] space-y-3">
            <li className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div aria-hidden="true" className="shrink-0">
                <LottieIcon src="/lottie/supporter-icon.lottie?v=3" size={48} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold sm:text-base">
                  Become a monthly member
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Recurring SEPA &middot; cancel anytime
                </p>
              </div>
            </li>

            <li className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
              <div
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
              >
                <IconHeartHandshake className="h-6 w-6 text-slate-600 dark:text-slate-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold sm:text-base">One-time donation</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Pick a cause to support
                </p>
              </div>
            </li>
          </ul>
        </section>
      </div>

      {/* Bottom Lottie progress — frame position tracks the focused campaign's
          raised %. Sweeps forward/back as the rotation advances between campaigns. */}
      <div aria-hidden="true" className="shrink-0 w-full overflow-hidden" style={{ height: 40 }}>
        <DotLottieReact
          src="/lottie/donation-progress.lottie"
          autoplay={false}
          loop={false}
          dotLottieRefCallback={dotLottieRefCallback}
          layout={{ fit: 'cover', align: [0, 0] }}
          style={{ width: '100%', height: 80 }}
        />
      </div>
    </main>
  );
}
