'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconHeartHandshake, IconCreditCard, IconChevronRight } from '@tabler/icons-react';
import { getCampaignIcon } from '@/lib/campaign-icons';
import { LottieIcon } from '@/components/lottie-icon';

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

export function DonateLandingClient({
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

  const selectedIconEntry = getCampaignIcon(selected?.icon);

  const hasGoal =
    selected?.goal_amount != null && selected.goal_amount > 0;
  const pct =
    hasGoal && selected
      ? Math.min(100, Math.round((selected.raised_cents / selected.goal_amount!) * 100))
      : null;

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
            <Link
              href={`/donate/${orgSlug}/${campaigns[0].slug}?recurring=true`}
              className="mb-6 flex w-full items-center gap-4 rounded-xl border border-[rgba(128,128,128,0.2)] bg-white p-5 transition-all hover:border-emerald-600 hover:shadow-lg active:scale-[0.98] dark:bg-slate-900/40 dark:hover:border-emerald-400"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600">
                <IconHeartHandshake className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold">Become a monthly supporter</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Recurring SEPA direct debit — cancel anytime
                </p>
              </div>
              <IconChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
            </Link>

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
                                className="h-full rounded-full bg-emerald-500"
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
                          className="h-full rounded-full bg-emerald-500 transition-all"
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

                {/* Payment CTAs */}
                <div className="space-y-4">
                  <Link
                    href={`/donate/${orgSlug}/${selected.slug}`}
                    className="flex w-full items-center gap-4 rounded-xl border border-[rgba(128,128,128,0.2)] bg-white p-5 transition-all hover:border-black hover:shadow-lg active:scale-[0.98] dark:bg-slate-900/40 dark:hover:border-white"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black dark:bg-white">
                      <IconCreditCard className="h-6 w-6 text-white dark:text-black" />
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-semibold">One-time donation</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        iDEAL, card, or other payment method
                      </p>
                    </div>
                    <IconChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                  </Link>

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
    </main>
  );
}
