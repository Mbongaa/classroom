'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Recurring-donor table for the finance dashboard. The page server-side
 * computes per-mandate aggregates (total collected, storno count, recent
 * storno flag) so the client just renders + filters.
 *
 * Filters:
 *   - free-text search across donor name, email, IBAN owner, mandate code
 *   - status pill (all / active / pending / cancelled / expired)
 *   - "at risk only" toggle — surfaces members with 2+ stornos in their
 *     last 3 attempts. Cancellation candidates.
 *
 * Cancel flow: confirmation dialog → POST /api/organizations/[id]/
 * mandates/[mandateId]/cancel → optimistic flip to CANCELLED on success.
 * The button is hidden entirely for non-admin viewers (canCancel=false).
 */

export interface MemberRow {
  id: string;
  paynl_mandate_id: string;
  mandate_type: string;
  donor_name: string;
  donor_email: string | null;
  iban_owner: string;
  status: string;
  monthly_amount: number | null;
  first_debit_at: string | null;
  created_at: string;
  campaign: { id: string; title: string; slug: string } | null;
  total_debits: number;
  total_collected_cents: number;
  last_collected_at: string | null;
  storno_count: number;
  recent_storno_flag: boolean;
}

interface MembersClientProps {
  organizationId: string;
  members: MemberRow[];
  canCancel: boolean;
}

type StatusFilter = 'all' | 'active' | 'pending' | 'cancelled' | 'expired';

function formatEuro(cents: number | null): string {
  if (cents === null || cents === undefined) return '—';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'PENDING':
      return 'secondary';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'outline';
    default:
      return 'outline';
  }
}

export function MembersClient({ organizationId, members, canCancel }: MembersClientProps) {
  const t = useTranslations('mosqueAdmin.members');
  const [rows, setRows] = useState<MemberRow[]>(members);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [cancelling, setCancelling] = useState<MemberRow | null>(null);
  const [pending, setPending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((m) => {
      if (statusFilter !== 'all' && m.status.toLowerCase() !== statusFilter) {
        return false;
      }
      if (atRiskOnly && !m.recent_storno_flag) {
        return false;
      }
      if (q) {
        const haystack = [
          m.donor_name,
          m.donor_email ?? '',
          m.iban_owner,
          m.paynl_mandate_id,
          m.campaign?.title ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, atRiskOnly]);

  const counts = useMemo(() => {
    let active = 0;
    let pendingCount = 0;
    let atRisk = 0;
    let totalCollected = 0;
    for (const m of rows) {
      if (m.status === 'ACTIVE') active += 1;
      if (m.status === 'PENDING') pendingCount += 1;
      if (m.recent_storno_flag) atRisk += 1;
      totalCollected += m.total_collected_cents;
    }
    return { active, pendingCount, atRisk, totalCollected };
  }, [rows]);

  async function handleConfirmCancel() {
    if (!cancelling) return;
    setPending(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/mandates/${cancelling.id}/cancel`,
        { method: 'POST' },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t('toast.cancelFailed'));
      }
      // Optimistic update — Pay.nl confirmed the cancellation.
      setRows((prev) =>
        prev.map((r) => (r.id === cancelling.id ? { ...r, status: 'CANCELLED' } : r)),
      );
      toast.success(t('toast.cancelled'));
      setCancelling(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.cancelFailed'));
    } finally {
      setPending(false);
    }
  }

  const filterLabel = (s: StatusFilter) => {
    switch (s) {
      case 'all':
        return t('filters.all');
      case 'active':
        return t('filters.active');
      case 'pending':
        return t('filters.pending');
      case 'cancelled':
        return t('filters.cancelled');
      case 'expired':
        return t('filters.expired');
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return t('status.ACTIVE');
      case 'PENDING':
        return t('status.PENDING');
      case 'CANCELLED':
        return t('status.CANCELLED');
      case 'EXPIRED':
        return t('status.EXPIRED');
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('summary.active')}
            </p>
            <p className="mt-1 text-2xl font-semibold">{counts.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('summary.pending')}
            </p>
            <p className="mt-1 text-2xl font-semibold">{counts.pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('summary.atRisk')}
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">
              {counts.atRisk}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('summary.collected')}
            </p>
            <p className="mt-1 text-2xl font-semibold">{formatEuro(counts.totalCollected)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t('filters.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'pending', 'cancelled', 'expired'] as StatusFilter[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
              className="rounded-full"
            >
              {filterLabel(s)}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant={atRiskOnly ? 'default' : 'outline'}
          onClick={() => setAtRiskOnly((v) => !v)}
          className="rounded-full"
        >
          {atRiskOnly ? t('filters.atRiskOnly') : t('filters.showAtRiskOnly')}
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-base font-medium">{t('empty.title')}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {rows.length === 0 ? t('empty.none') : t('empty.clear')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(128,128,128,0.3)] text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">{t('table.donor')}</th>
                    <th className="px-4 py-3">{t('table.campaign')}</th>
                    <th className="px-4 py-3">{t('table.monthly')}</th>
                    <th className="px-4 py-3">{t('table.collected')}</th>
                    <th className="px-4 py-3">{t('table.lastDebit')}</th>
                    <th className="px-4 py-3">{t('table.stornos')}</th>
                    <th className="px-4 py-3">{t('table.status')}</th>
                    {canCancel && <th className="px-4 py-3 text-right">{t('table.actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const canCancelRow =
                      canCancel && m.status !== 'CANCELLED' && m.status !== 'EXPIRED';
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-[rgba(128,128,128,0.15)] last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{m.donor_name}</span>
                            {m.donor_email && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {m.donor_email}
                              </span>
                            )}
                            <code className="text-[10px] text-slate-400">
                              {m.paynl_mandate_id}
                            </code>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                          {m.campaign?.title ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-medium">{formatEuro(m.monthly_amount)}</td>
                        <td className="px-4 py-3 font-medium">
                          {formatEuro(m.total_collected_cents)}
                          <span className="ml-1 text-xs text-slate-400">
                            ({m.total_debits})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(m.last_collected_at)}
                        </td>
                        <td className="px-4 py-3">
                          {m.recent_storno_flag ? (
                            <Badge
                              variant="destructive"
                              title={t('table.recentStornoTooltip')}
                            >
                              {t('table.recentStorno', { count: m.storno_count })}
                            </Badge>
                          ) : m.storno_count > 0 ? (
                            <Badge variant="outline">{m.storno_count}</Badge>
                          ) : (
                            <span className="text-xs text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusBadgeVariant(m.status)}>{statusLabel(m.status)}</Badge>
                        </td>
                        {canCancel && (
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              {canCancelRow ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                                  onClick={() => setCancelling(m)}
                                >
                                  {t('table.cancel')}
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setCancelling(null);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('cancelDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('cancelDialog.description')}
            </DialogDescription>
          </DialogHeader>
          {cancelling && (
            <div className="rounded-lg border border-[rgba(128,128,128,0.3)] bg-slate-50 p-3 text-sm dark:bg-slate-900/40">
              <p>
                <span className="text-slate-500">{t('cancelDialog.donorLabel')}</span>{' '}
                <span className="font-medium">{cancelling.donor_name}</span>
              </p>
              {cancelling.donor_email && (
                <p>
                  <span className="text-slate-500">{t('cancelDialog.emailLabel')}</span> {cancelling.donor_email}
                </p>
              )}
              <p>
                <span className="text-slate-500">{t('cancelDialog.mandateLabel')}</span>{' '}
                <code className="text-xs">{cancelling.paynl_mandate_id}</code>
              </p>
              <p>
                <span className="text-slate-500">{t('cancelDialog.totalCollectedLabel')}</span>{' '}
                {formatEuro(cancelling.total_collected_cents)} {t('cancelDialog.debitsCount', { count: cancelling.total_debits })}
              </p>
              {cancelling.recent_storno_flag && (
                <p className="mt-2 text-amber-700 dark:text-amber-400">
                  {t('cancelDialog.stornoWarning', { count: cancelling.storno_count })}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelling(null)}
              disabled={pending}
            >
              {t('cancelDialog.keep')}
            </Button>
            <Button
              variant="default"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleConfirmCancel}
              disabled={pending}
            >
              {pending ? t('cancelDialog.cancelling') : t('cancelDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
