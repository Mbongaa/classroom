'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { IconLanguage, IconCurrencyEuro } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

/**
 * Segmented toggle between the two dashboard types:
 *   - Translation (current classroom dashboard) → /dashboard
 *   - Finance (Pay.nl donations admin)          → /mosque-admin/[orgSlug]
 *
 * Rendered inside the shared DashboardHeader so it lives in the exact same
 * spot on both sides — the user never loses the toggle when switching modes.
 *
 * Detects the active mode from the current URL pathname.
 *
 * When `orgSlug` is null (the user has no primary org yet), the finance side
 * is rendered as a disabled affordance instead of a link, so the user isn't
 * sent to a 404 /mosque-admin/undefined route.
 */

interface DashboardModeToggleProps {
  /** Org slug for the finance route. Null = user has no primary org yet. */
  orgSlug: string | null;
}

export function DashboardModeToggle({ orgSlug }: DashboardModeToggleProps) {
  const pathname = usePathname();
  const t = useTranslations('header.mode');
  const financeActive = pathname.startsWith('/mosque-admin');
  const translationActive = !financeActive;
  const financeHref = orgSlug ? `/mosque-admin/${orgSlug}` : null;

  return (
    <div
      role="tablist"
      aria-label={t('label')}
      className="inline-flex items-center gap-0.5 rounded-full border border-[rgba(128,128,128,0.3)] bg-slate-200/80 p-0.5 dark:bg-slate-800/60"
    >
      <Link
        href="/dashboard"
        role="tab"
        aria-selected={translationActive}
        aria-label={t('translation')}
        title={t('translation')}
        className={cn(
          'flex h-8 w-10 items-center justify-center rounded-full transition-colors',
          translationActive
            ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-300 dark:bg-background dark:text-foreground dark:shadow-sm dark:ring-0'
            : 'text-slate-600 hover:text-foreground dark:text-slate-400',
        )}
      >
        <IconLanguage className="h-4 w-4" />
      </Link>
      {financeHref ? (
        <Link
          href={financeHref}
          role="tab"
          aria-selected={financeActive}
          aria-label={t('finance')}
          title={t('finance')}
          className={cn(
            'flex h-8 w-10 items-center justify-center rounded-full transition-colors',
            financeActive
              ? 'bg-background text-foreground shadow-sm'
              : 'text-slate-500 hover:text-foreground dark:text-slate-400',
          )}
        >
          <IconCurrencyEuro className="h-4 w-4" />
        </Link>
      ) : (
        <span
          role="tab"
          aria-selected={false}
          aria-disabled
          aria-label={t('financeDisabled')}
          title={t('financeDisabledTitle')}
          className="flex h-8 w-10 cursor-not-allowed items-center justify-center rounded-full text-slate-400 opacity-50 dark:text-slate-600"
        >
          <IconCurrencyEuro className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}
