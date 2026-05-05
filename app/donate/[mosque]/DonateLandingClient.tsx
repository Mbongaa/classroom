'use client';

import Link from 'next/link';
import { IconChevronRight, IconHeartHandshake } from '@tabler/icons-react';
import { LottieIcon } from '@/components/lottie-icon';

/**
 * Phone-first donation chooser.
 *
 * Reached by scanning the kiosk QR or by direct link to /donate/[mosque].
 * Two top-level paths:
 *   1. Become a member  → /donate/[mosque]/member        (org-level SEPA mandate)
 *   2. One-time donation → /donate/[mosque]/[campaign]   (per-campaign checkout)
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
  return (
    <main className="flex min-h-[100svh] flex-col bg-white text-slate-900 dark:bg-black dark:text-white">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <span className="text-sm font-semibold">{orgName}</span>
          <span className="text-[11px] text-slate-400">
            Powered by{' '}
            <a
              href="https://www.bayaan.app"
              className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Bayaan
            </a>
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Intro */}
        <section className="text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">Support {orgName}</h1>
          {(orgCity || orgDescription) && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {orgDescription ?? `${orgCity ? `${orgCity}, ` : ''}${orgCountry}`}
            </p>
          )}
        </section>

        {/* Member CTA */}
        <Link
          href={`/donate/${orgSlug}/member`}
          className="mt-7 flex w-full items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 text-left transition-all hover:border-emerald-400 hover:shadow-md active:scale-[0.99] dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:hover:border-emerald-500"
        >
          <div aria-hidden="true" className="shrink-0">
            <LottieIcon src="/lottie/supporter-icon.lottie?v=3" size={56} />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold sm:text-lg">Become a monthly member</p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Recurring SEPA direct debit. Cancel anytime.
            </p>
          </div>
          <IconChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
        </Link>

        {/* Divider */}
        <div className="my-7 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Or one-time donation
          </span>
          <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
        </div>

        {/* Campaign list */}
        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 p-6 text-center dark:border-slate-800">
            <div
              aria-hidden="true"
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
            >
              <IconHeartHandshake className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium">No active campaigns yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Check back soon — or become a monthly member to support {orgName} directly.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {campaigns.map((campaign) => {
              const hasGoal = campaign.goal_amount != null && campaign.goal_amount > 0;
              const pct = hasGoal
                ? Math.min(
                    100,
                    Math.round((campaign.raised_cents / campaign.goal_amount!) * 100),
                  )
                : null;
              return (
                <li key={campaign.id}>
                  <Link
                    href={`/donate/${orgSlug}/${campaign.slug}`}
                    className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-400 hover:shadow-sm active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-600"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{campaign.title}</span>
                        {campaign.cause_type && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {campaign.cause_type}
                          </span>
                        )}
                      </div>
                      {campaign.description && (
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {campaign.description}
                        </p>
                      )}
                      {hasGoal && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {formatEuro(campaign.raised_cents)} of{' '}
                            {formatEuro(campaign.goal_amount!)}
                          </span>
                        </div>
                      )}
                    </div>
                    <IconChevronRight
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 text-slate-400"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
