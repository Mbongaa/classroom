'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { IconHeartHandshake, IconChevronRight, IconX } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import { getCampaignIcon } from '@/lib/campaign-icons';
import dynamic from 'next/dynamic';
import { LottieIcon } from '@/components/lottie-icon';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false },
);

/**
 * Dual-pane donation landing for the POS / kiosk tablet.
 *
 * Left pane:  campaign rows — tap to select
 * Right pane: selected campaign details + two payment CTAs
 *
 * Both panes are vertically centered within the viewport.
 */

export interface CampaignDisplay {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  cause_type: string | null;
  icon: string | null;
  raised_cents: number;
}

interface DonateLandingClientProps {
  orgId: string;
  orgSlug: string;
  orgName: string;
  orgCity: string | null;
  orgCountry: string;
  orgDescription: string | null;
  campaigns: CampaignDisplay[];
}

function formatEuro(cents: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Auto-timeout for QR overlay (ms). */
const QR_TIMEOUT_MS = 60_000;

export function DonateLandingClient({
  orgId,
  orgSlug,
  orgName,
  orgCity,
  orgCountry,
  orgDescription,
  campaigns,
}: DonateLandingClientProps) {
  const [selected, setSelected] = useState<CampaignDisplay | null>(
    campaigns.length > 0 ? campaigns[0] : null,
  );

  // QR overlay state
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrKind, setQrKind] = useState<'one-time' | 'recurring' | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const realtimeChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeQrOverlay = useCallback(() => {
    setQrSessionId(null);
    setQrUrl(null);
    setQrKind(null);
    if (realtimeChannelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Generic QR overlay opener. Creates a kiosk session, builds the
   * phone URL, and subscribes to Realtime for scan detection.
   *
   * @param campaignSlug  - which campaign the QR points to
   * @param kind          - 'one-time' or 'recurring' (controls overlay copy + URL params)
   */
  async function openQrOverlay(campaignSlug: string, kind: 'one-time' | 'recurring') {
    if (creatingSession) return;
    setCreatingSession(true);

    try {
      const res = await fetch('/api/kiosk-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: orgId,
          campaign_slug: campaignSlug,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create session');

      const sessionId = data.id as string;
      const params = new URLSearchParams({ kiosk: sessionId });
      if (kind === 'recurring') params.set('recurring', 'true');
      const donateUrl = `${window.location.origin}/donate/${orgSlug}/${campaignSlug}?${params.toString()}`;

      setQrSessionId(sessionId);
      setQrUrl(donateUrl);
      setQrKind(kind);

      // Subscribe to Realtime updates on this session row.
      const supabase = createClient();
      const channel = supabase
        .channel(`kiosk-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'kiosk_sessions',
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            if ((payload.new as { status?: string }).status === 'scanned') {
              closeQrOverlay();
            }
          },
        )
        .subscribe();

      realtimeChannelRef.current = channel;

      // Auto-timeout fallback
      timeoutRef.current = setTimeout(() => {
        closeQrOverlay();
      }, QR_TIMEOUT_MS);
    } catch {
      // Silently fail — worst case the link still works as a direct tap
    } finally {
      setCreatingSession(false);
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(realtimeChannelRef.current);
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const selectedIconEntry = getCampaignIcon(selected?.icon);

  const hasGoal =
    selected?.goal_amount != null && selected.goal_amount > 0;
  const pct =
    hasGoal && selected
      ? Math.min(100, Math.round((selected.raised_cents / selected.goal_amount!) * 100))
      : null;

  // ---- Bottom Lottie progress driven by selected campaign % ----
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
    instance.setSpeed(2);
    instance.play();
  }, []);

  const dotLottieRefCallback = useCallback(
    (dotLottie: any) => {
      dotLottieRef.current = dotLottie;
      if (dotLottie) {
        dotLottie.addEventListener('load', () => {
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
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-[rgba(128,128,128,0.15)] px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{orgName}</h1>
            {orgCity && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
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

      {campaigns.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <p className="text-lg font-medium">No active campaigns</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Check back soon — {orgName} is setting up their donation causes.
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:flex-row">
          {/* ---- Left pane: campaign rows ---- */}
          <div className="flex flex-1 flex-col justify-center overflow-y-auto border-r border-[rgba(128,128,128,0.15)] p-6 md:max-w-[55%]">
            {orgDescription && (
              <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
                {orgDescription}
              </p>
            )}

            {/* Monthly supporter — org-level, independent of campaign selection */}
            <button
              type="button"
              onClick={() => openQrOverlay(campaigns[0].slug, 'recurring')}
              disabled={creatingSession}
              className="mb-6 flex w-full items-center gap-4 rounded-xl border border-[rgba(128,128,128,0.2)] bg-white p-5 text-left transition-all hover:border-emerald-600 hover:shadow-lg active:scale-[0.98] dark:bg-slate-900/40 dark:hover:border-emerald-400"
            >
              <div className="shrink-0">
                <LottieIcon src="/lottie/supporter-icon.lottie?v=3" size={48} />
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold">Become a monthly supporter</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Recurring SEPA direct debit — cancel anytime
                </p>
              </div>
              <IconChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
            </button>

            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Choose a cause
            </h2>
            <div className="overflow-hidden rounded-xl border border-[rgba(128,128,128,0.15)]">
              {campaigns.map((campaign, i) => {
                const isSelected = selected?.id === campaign.id;
                const isLast = i === campaigns.length - 1;
                const cHasGoal =
                  campaign.goal_amount != null && campaign.goal_amount > 0;
                const cPct = cHasGoal
                  ? Math.min(
                      100,
                      Math.round(
                        (campaign.raised_cents / campaign.goal_amount!) * 100,
                      ),
                    )
                  : null;

                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => setSelected(campaign)}
                    className={`flex w-full items-center gap-4 px-5 py-4 text-left transition-colors ${
                      isSelected
                        ? 'bg-slate-50 dark:bg-slate-900/60'
                        : 'bg-white hover:bg-slate-50/60 dark:bg-transparent dark:hover:bg-slate-900/30'
                    } ${!isLast ? 'border-b border-[rgba(128,128,128,0.1)]' : ''}`}
                  >
                    {/* Selection indicator */}
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        isSelected
                          ? 'border-black bg-black dark:border-white dark:bg-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && (
                        <div className="h-2 w-2 rounded-full bg-white dark:bg-black" />
                      )}
                    </div>

                    {/* Campaign info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{campaign.title}</span>
                        {campaign.cause_type && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {campaign.cause_type}
                          </span>
                        )}
                      </div>
                      {campaign.description && (
                        <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                          {campaign.description}
                        </p>
                      )}
                    </div>

                    {/* Raised / goal on the right */}
                    <div className="shrink-0 text-right">
                      {cHasGoal ? (
                        <>
                          <p className="text-sm font-semibold">
                            {formatEuro(campaign.raised_cents)}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                className="h-full rounded-full bg-[#30f2cf]"
                                style={{ width: `${cPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {formatEuro(campaign.goal_amount!)}
                            </span>
                          </div>
                        </>
                      ) : campaign.raised_cents > 0 ? (
                        <p className="text-sm font-semibold">
                          {formatEuro(campaign.raised_cents)}
                        </p>
                      ) : (
                        <IconChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---- Right pane: payment options ---- */}
          <div className="flex flex-1 items-center justify-center p-6 md:p-10">
            {selected ? (
              <div className="w-full max-w-sm">
                {/* Selected campaign recap */}
                <div className="mb-8 text-center">
                  {selected.cause_type && (
                    <span className="mb-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {selected.cause_type}
                    </span>
                  )}
                  <h2 className="mt-2 text-2xl font-bold">{selected.title}</h2>
                  {selected.description && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {selected.description}
                    </p>
                  )}
                  {hasGoal && (
                    <div className="mt-4">
                      <div className="mx-auto h-2 max-w-xs overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-[#30f2cf] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm">
                        <span className="font-semibold">
                          {formatEuro(selected.raised_cents)}
                        </span>{' '}
                        <span className="text-slate-500 dark:text-slate-400">
                          of {formatEuro(selected.goal_amount!)} · {pct}%
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Payment CTA */}
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => openQrOverlay(selected!.slug, 'one-time')}
                    disabled={creatingSession}
                    className="flex w-full items-center gap-4 rounded-xl border border-[rgba(128,128,128,0.2)] bg-white p-5 text-left transition-all hover:border-black hover:shadow-lg active:scale-[0.98] dark:bg-slate-900/40 dark:hover:border-white"
                  >
                    <div className="shrink-0">
                      <LottieIcon src="/lottie/qr-code.json" size={64} className="dark:hidden" />
                      <LottieIcon src="/lottie/qr-code-white.json" size={64} className="hidden dark:block" />
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-semibold">
                        {creatingSession ? 'Preparing…' : 'One-time donation'}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Scan the QR code with your phone to donate
                      </p>
                    </div>
                    <IconChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                  </button>
                </div>

                {/* Campaign icon animation */}
                {selectedIconEntry && (
                  <div className="-mx-6 mt-8 flex justify-center md:-mx-10">
                    <LottieIcon src={selectedIconEntry.file} size={360} />
                  </div>
                )}

                {/* Back / deselect on mobile */}
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="mt-6 block w-full text-center text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400 md:hidden"
                >
                  ← Choose a different cause
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <IconHeartHandshake className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-lg font-medium">Select a campaign</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Choose a cause on the left to see donation options
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Bottom Lottie progress — driven by selected campaign % ---- */}
      <div className="mt-auto w-screen overflow-hidden" style={{ height: 60 }}>
        <DotLottieReact
          src="/lottie/donation-progress.lottie"
          autoplay={false}
          loop={false}
          dotLottieRefCallback={dotLottieRefCallback}
          style={{ width: '100vw', height: 120 }}
        />
      </div>

      {/* ---- QR Code Overlay ---- */}
      {qrUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-slate-900">
            <button
              type="button"
              onClick={closeQrOverlay}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Close"
            >
              <IconX className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold">
              {qrKind === 'recurring' ? 'Become a monthly supporter' : 'Scan to donate'}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {qrKind === 'recurring'
                ? 'Scan with your phone to set up a recurring donation'
                : 'Open your phone camera and scan this QR code'}
            </p>

            <div className="mx-auto mt-6 inline-block rounded-xl bg-white p-4">
              <QRCodeSVG
                value={qrUrl}
                size={240}
                level="M"
                includeMargin={false}
              />
            </div>

            <p className="mt-4 text-xs text-slate-400">
              {selected?.title} — {orgName}
            </p>
            <p className="mt-6 text-xs text-slate-400">
              This screen will close automatically when the QR is scanned
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
