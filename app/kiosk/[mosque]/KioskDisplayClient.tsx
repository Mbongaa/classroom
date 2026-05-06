'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import dynamic from 'next/dynamic';
import { IconMaximize, IconMinimize } from '@tabler/icons-react';
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

  // Viewport-size category — drives QR + info-card icon sizes that take a
  // fixed-pixel prop (Tailwind responsive classes can't reach those).
  const [screenSize, setScreenSize] = useState<'sm' | 'xl' | '2xl'>('sm');
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1536) setScreenSize('2xl');
      else if (w >= 1280) setScreenSize('xl');
      else setScreenSize('sm');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const qrSize = screenSize === '2xl' ? 440 : screenSize === 'xl' ? 380 : 300;
  const memberIconSize = screenSize === '2xl' ? 64 : screenSize === 'xl' ? 56 : 48;
  const qrCodeIconSize = screenSize === '2xl' ? 48 : screenSize === 'xl' ? 42 : 36;

  // Fullscreen toggle. Tracks the document state so an ESC-keyed exit also
  // updates the icon.
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  // Build the absolute QR target on the client so it picks up the actual
  // origin (works for subdomains like elfeth.bayaan.app).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDonateUrl(`${window.location.origin}/donate/${orgSlug}`);
  }, [orgSlug]);

  // Auto-rotate campaign focus. `index` is in deps so a user tap on a picker
  // row resets the 10s clock — the bottom timer bar (also keyed on index)
  // then truthfully reflects when the next rotation will fire.
  useEffect(() => {
    if (campaigns.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % campaigns.length);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [campaigns.length, index]);

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
      <header className="shrink-0 border-b border-[rgba(128,128,128,0.15)] px-8 py-3 lg:px-12 xl:px-20 xl:py-4 2xl:px-28">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl xl:text-4xl">{orgName}</h1>
            {orgCity && (
              <p className="text-sm text-slate-500 dark:text-slate-400 xl:text-base">
                {orgCity}, {orgCountry}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 xl:gap-4">
            <p className="text-xs text-slate-400 xl:text-sm">
              Powered by{' '}
              <a
                href="https://www.bayaan.app"
                className="underline underline-offset-4 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Bayaan
              </a>
            </p>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 xl:h-10 xl:w-10"
            >
              {isFullscreen ? (
                <IconMinimize size={screenSize === 'sm' ? 18 : 20} stroke={1.75} />
              ) : (
                <IconMaximize size={screenSize === 'sm' ? 18 : 20} stroke={1.75} />
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 w-full flex-1 flex-col gap-8 px-8 py-8 md:flex-row md:items-stretch lg:gap-12 lg:px-12 xl:gap-16 xl:px-20 2xl:gap-20 2xl:px-28">
        {/* ---- Left: rotating campaign focus + tappable picker rows ---- */}
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 text-center xl:gap-10">
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
              <>
                {/* Focus block: text content on the LEFT, big icon on the
                    RIGHT — single horizontal row across all kiosk sizes. */}
                <div
                  key={current.id}
                  className="flex min-h-[280px] w-full items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-2 duration-700 md:gap-8 xl:min-h-[420px] xl:gap-14 2xl:gap-20"
                >
                  <div className="flex min-w-0 max-w-2xl flex-col items-start text-left">
                    {current.cause_type && (
                      <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {current.cause_type}
                      </span>
                    )}
                    <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl xl:text-5xl 2xl:text-6xl">
                      {current.title}
                    </h2>
                    {current.description && (
                      <p className="mt-2 hidden line-clamp-2 max-w-xl text-base text-slate-600 dark:text-slate-300 xl:block xl:text-lg">
                        {current.description}
                      </p>
                    )}
                    {hasGoal && (
                      <div className="mt-4 w-full max-w-md xl:mt-6">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 xl:h-3">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-2 text-sm xl:text-base">
                          <span className="font-semibold">
                            {formatEuro(current.raised_cents)}
                          </span>{' '}
                          <span className="text-slate-500 dark:text-slate-400">
                            of {formatEuro(current.goal_amount!)} &middot; {pct}%
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  {currentIcon && (
                    <div
                      aria-hidden="true"
                      className="aspect-square w-[180px] shrink-0 md:w-[220px] xl:w-[300px] 2xl:w-[360px]"
                    >
                      <LottieIcon
                        src={currentIcon.file}
                        className="h-full"
                        fit="cover"
                      />
                    </div>
                  )}
                </div>

                {/* Tappable picker rows — tapping a row jumps the rotation
                    focus to that campaign (no navigation, no payment flow —
                    payment still happens via the persistent QR on the right). */}
                {campaigns.length > 1 && (
                  <div className="w-full max-w-2xl md:max-w-3xl xl:max-w-5xl 2xl:max-w-6xl">
                    <ul role="list" className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-x-3 md:gap-y-2">
                      {campaigns.map((c, i) => {
                        const isActive = i === index;
                        const rowIcon = getCampaignIcon(c.icon);
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => setIndex(i)}
                              aria-current={isActive ? 'true' : undefined}
                              className={[
                                'group relative flex w-full items-center gap-4 overflow-hidden rounded-xl border px-4 py-3 text-left transition-all duration-300 ease-out',
                                'motion-reduce:transition-none',
                                isActive
                                  ? 'border-emerald-400 bg-emerald-50/80 shadow-[0_0_0_3px_rgb(16_185_129_/_0.18)] dark:border-emerald-500 dark:bg-emerald-950/50'
                                  : 'border-slate-200 bg-white/60 hover:border-slate-300 hover:bg-white active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900/30 dark:hover:border-slate-700 dark:hover:bg-slate-900/60',
                              ].join(' ')}
                            >
                              {rowIcon ? (
                                <div aria-hidden="true" className="shrink-0">
                                  <LottieIcon src={rowIcon.file} size={40} />
                                </div>
                              ) : (
                                <div aria-hidden="true" className="h-10 w-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`truncate text-base font-semibold sm:text-lg ${
                                    isActive
                                      ? 'text-slate-900 dark:text-slate-50'
                                      : 'text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  {c.title}
                                </p>
                                {c.cause_type && (
                                  <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-500">
                                    {c.cause_type}
                                  </p>
                                )}
                              </div>
                              {isActive && (
                                <span className="shrink-0 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                                  Now
                                </span>
                              )}
                              {isActive && (
                                <span
                                  key={`timer-${index}`}
                                  aria-hidden="true"
                                  className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1 origin-left bg-emerald-500 motion-reduce:hidden"
                                  style={{ animation: 'kioskTileTimer 10000ms linear forwards' }}
                                />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <style>{`
                      @keyframes kioskTileTimer {
                        from { transform: scaleX(0); }
                        to { transform: scaleX(1); }
                      }
                    `}</style>
                  </div>
                )}
              </>
            )
          )}
        </section>

        {/* ---- Right: permanent QR + the two donor options ---- */}
        <section className="flex shrink-0 flex-col items-center justify-center md:w-[400px] xl:w-[560px] 2xl:w-[680px]">
          <div className="rounded-2xl border border-[rgba(128,128,128,0.2)] bg-white p-6 shadow-md xl:p-8 2xl:p-10">
            {donateUrl ? (
              <QRCodeSVG value={donateUrl} size={qrSize} level="M" includeMargin={false} />
            ) : (
              <div
                className="animate-pulse rounded bg-slate-100"
                style={{ width: qrSize, height: qrSize }}
              />
            )}
          </div>
          <p className="mt-5 text-center text-lg font-semibold xl:text-2xl 2xl:text-3xl">
            Scan to donate
          </p>

          {/* Two informational option cards (informational on screen kiosks;
              tappable on tablet kiosks but they don't navigate — they just
              describe what the donor will see when they scan). */}
          <ul className="mt-5 w-full max-w-[360px] space-y-3 xl:mt-6 xl:max-w-[480px] xl:space-y-4 2xl:max-w-[560px]">
            <li className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20 xl:gap-5 xl:p-5 2xl:gap-6 2xl:p-6">
              <div aria-hidden="true" className="shrink-0">
                <LottieIcon src="/lottie/supporter-icon.lottie?v=3" size={memberIconSize} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold sm:text-base xl:text-lg 2xl:text-xl">
                  Become a monthly member
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 xl:text-sm 2xl:text-base">
                  Recurring SEPA &middot; cancel anytime
                </p>
              </div>
            </li>

            <li className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 xl:gap-5 xl:p-5 2xl:gap-6 2xl:p-6">
              <div aria-hidden="true" className="shrink-0">
                {/* Light/dark variants. Swapped via Tailwind so we don't need
                    a theme hook — and SSR renders the right one immediately. */}
                <div className="block dark:hidden">
                  <LottieIcon src="/lottie/qr-code.json" size={qrCodeIconSize} />
                </div>
                <div className="hidden dark:block">
                  <LottieIcon src="/lottie/qr-code-white.json" size={qrCodeIconSize} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold sm:text-base xl:text-lg 2xl:text-xl">
                  One-time donation
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 xl:text-sm 2xl:text-base">
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
