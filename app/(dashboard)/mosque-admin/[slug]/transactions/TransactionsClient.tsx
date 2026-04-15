'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/**
 * Unified transactions ledger. Receives a server-merged list of one-time
 * orders and recurring SEPA debits and lets the admin slice it by:
 *
 *   - kind: all / one-time / recurring
 *   - status pill: all / paid+collected (success) / pending / failed
 *   - free-text donor search
 *   - simple "tail-N" pagination (no need for keyset at this scale)
 *
 * Status normalisation: the two source tables use different vocabularies
 * (PAID/CANCEL/EXPIRED vs COLLECTED/STORNO/DECLINED). We collapse them
 * into three buckets in the filter — `success`, `pending`, `failed` —
 * but show the raw status in the table column so admins can still
 * tell a STORNO from a CANCEL at a glance.
 */

export interface UnifiedTransaction {
  id: string;
  kind: 'one-time' | 'recurring';
  reference: string;
  amount: number;
  currency: string;
  status: string;
  donor_name: string | null;
  donor_email: string | null;
  payment_method: string | null;
  campaign_title: string | null;
  campaign_slug: string | null;
  sort_date: string;
  created_at: string;
  is_test: boolean;
}

interface TransactionsClientProps {
  transactions: UnifiedTransaction[];
}

type KindFilter = 'all' | 'one-time' | 'recurring';
type StatusBucket = 'all' | 'success' | 'pending' | 'failed';

const PAGE_SIZE = 50;

const SUCCESS_STATUSES = new Set(['PAID', 'COLLECTED']);
const PENDING_STATUSES = new Set(['PENDING']);
const FAILED_STATUSES = new Set(['CANCEL', 'EXPIRED', 'STORNO', 'DECLINED']);

function bucketFor(status: string): StatusBucket {
  if (SUCCESS_STATUSES.has(status)) return 'success';
  if (PENDING_STATUSES.has(status)) return 'pending';
  if (FAILED_STATUSES.has(status)) return 'failed';
  return 'all';
}

function formatEuro(cents: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (SUCCESS_STATUSES.has(status)) return 'default';
  if (PENDING_STATUSES.has(status)) return 'secondary';
  if (status === 'STORNO' || status === 'DECLINED') return 'destructive';
  return 'outline';
}

export function TransactionsClient({ transactions }: TransactionsClientProps) {
  const t = useTranslations('mosqueAdmin.transactions');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [statusBucket, setStatusBucket] = useState<StatusBucket>('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false;
      if (statusBucket !== 'all' && bucketFor(t.status) !== statusBucket) return false;
      if (q) {
        const haystack = [
          t.donor_name ?? '',
          t.donor_email ?? '',
          t.reference,
          t.campaign_title ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, search, kindFilter, statusBucket]);

  // Reset to page 1 when filters change.
  // (useMemo dependency on `filtered` would cause an infinite loop, so
  // derive `currentPage` from a min() with the available pages instead.)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totals = useMemo(() => {
    let count = 0;
    let collected = 0;
    let pendingCount = 0;
    let failedCount = 0;
    for (const t of filtered) {
      count += 1;
      const bucket = bucketFor(t.status);
      if (bucket === 'success') collected += t.amount;
      if (bucket === 'pending') pendingCount += 1;
      if (bucket === 'failed') failedCount += 1;
    }
    return { count, collected, pendingCount, failedCount };
  }, [filtered]);

  function changeFilter(updater: () => void) {
    updater();
    setPage(1);
  }

  const kindLabel = (k: KindFilter) => {
    switch (k) {
      case 'all':
        return t('filters.all');
      case 'one-time':
        return t('filters.oneTime');
      case 'recurring':
        return t('filters.recurring');
    }
  };

  const bucketLabel = (s: StatusBucket) => {
    switch (s) {
      case 'all':
        return t('filters.all');
      case 'success':
        return t('filters.success');
      case 'pending':
        return t('filters.pending');
      case 'failed':
        return t('filters.failed');
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'PAID':
        return t('txStatus.PAID');
      case 'PENDING':
        return t('txStatus.PENDING');
      case 'CANCEL':
        return t('txStatus.CANCEL');
      case 'EXPIRED':
        return t('txStatus.EXPIRED');
      case 'COLLECTED':
        return t('txStatus.COLLECTED');
      case 'STORNO':
        return t('txStatus.STORNO');
      case 'DECLINED':
        return t('txStatus.DECLINED');
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
              {t('summary.matching')}
            </p>
            <p className="mt-1 text-2xl font-semibold">{totals.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('summary.collected')}
            </p>
            <p className="mt-1 text-2xl font-semibold">{formatEuro(totals.collected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('summary.pending')}
            </p>
            <p className="mt-1 text-2xl font-semibold">{totals.pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('summary.failed')}
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">
              {totals.failedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t('filters.searchPlaceholder')}
          value={search}
          onChange={(e) => changeFilter(() => setSearch(e.target.value))}
          className="max-w-sm"
        />
        <div className="flex gap-2">
          {(['all', 'one-time', 'recurring'] as KindFilter[]).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={kindFilter === k ? 'default' : 'outline'}
              onClick={() => changeFilter(() => setKindFilter(k))}
              className="rounded-full"
            >
              {kindLabel(k)}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {(['all', 'success', 'pending', 'failed'] as StatusBucket[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusBucket === s ? 'default' : 'outline'}
              onClick={() => changeFilter(() => setStatusBucket(s))}
              className="rounded-full"
            >
              {bucketLabel(s)}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-base font-medium">{t('empty.title')}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {transactions.length === 0 ? t('empty.none') : t('empty.clear')}
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
                    <th className="px-4 py-3">{t('table.date')}</th>
                    <th className="px-4 py-3">{t('table.donor')}</th>
                    <th className="px-4 py-3">{t('table.campaign')}</th>
                    <th className="px-4 py-3">{t('table.type')}</th>
                    <th className="px-4 py-3">{t('table.amount')}</th>
                    <th className="px-4 py-3">{t('table.status')}</th>
                    <th className="px-4 py-3">{t('table.reference')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-[rgba(128,128,128,0.15)] last:border-b-0"
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(tx.sort_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{tx.donor_name || '—'}</span>
                          {tx.donor_email && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {tx.donor_email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {tx.campaign_title ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={tx.kind === 'recurring' ? 'secondary' : 'outline'}>
                          {tx.kind === 'recurring' ? t('table.sepa') : (tx.payment_method || t('table.oneTime'))}
                        </Badge>
                        {tx.is_test && (
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            {t('table.test')}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{formatEuro(tx.amount)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant(tx.status)}>{statusLabel(tx.status)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-[10px] text-slate-500">{tx.reference}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <p>
            {t('pagination.info', { page: safePage, total: totalPages, count: filtered.length })}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              {t('pagination.previous')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
