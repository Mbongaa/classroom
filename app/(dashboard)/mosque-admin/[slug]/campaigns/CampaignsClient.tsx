'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { TrashIcon } from '@/components/ui/trash';
import { CampaignFormDialog } from './CampaignFormDialog';

/**
 * Client-side campaign manager. Receives the initial list from the server
 * page and keeps it in local state so create / edit / delete / toggle
 * operations don't need a full page reload. The server is still the source
 * of truth: every mutation hits the API and replaces the relevant row with
 * whatever the API returns, so we never drift from the database.
 *
 * The empty state nudges admins toward creating their first campaign,
 * since the donate page won't show anything until at least one
 * `is_active = true` campaign exists for this org.
 */

export interface Campaign {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  cause_type: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Campaign enriched with server-computed raised amount. Kept separate from
 * Campaign so the form dialog (which only cares about DB columns) doesn't
 * need to know about aggregates.
 */
export interface CampaignWithRaised extends Campaign {
  raised_cents: number;
}

interface CampaignsClientProps {
  organizationId: string;
  organizationSlug: string;
  initialCampaigns: CampaignWithRaised[];
  canManage: boolean;
  canDelete: boolean;
}

function formatEuro(cents: number | null): string {
  if (cents === null) return '—';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Sort: active first, then by sort_order, then by created_at desc. */
function sortCampaigns(list: CampaignWithRaised[]): CampaignWithRaised[] {
  return [...list].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function CampaignsClient({
  organizationId,
  organizationSlug,
  initialCampaigns,
  canManage,
  canDelete,
}: CampaignsClientProps) {
  const t = useTranslations('mosqueAdmin.campaigns');
  const [campaigns, setCampaigns] = useState<CampaignWithRaised[]>(initialCampaigns);
  const [editing, setEditing] = useState<CampaignWithRaised | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reordering, setReordering] = useState(false);

  const activeCampaigns = campaigns.filter((c) => c.is_active);
  const inactiveCampaigns = campaigns.filter((c) => !c.is_active);

  function handleCreated(created: Campaign) {
    setCampaigns((prev) => sortCampaigns([{ ...created, raised_cents: 0 }, ...prev]));
  }

  function handleUpdated(updated: Campaign) {
    setCampaigns((prev) =>
      sortCampaigns(
        prev.map((c) => (c.id === updated.id ? { ...updated, raised_cents: c.raised_cents } : c)),
      ),
    );
  }

  function handleDeleted(id: string) {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  async function persistOrder(reordered: CampaignWithRaised[]) {
    setReordering(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/campaigns/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_ids: reordered.map((c) => c.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('toast.reorderFailed'));
      }
      toast.success(t('toast.orderUpdated'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.reorderFailed'));
    } finally {
      setReordering(false);
    }
  }

  function handleMove(campaignId: string, direction: 'up' | 'down') {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) return;

    // Only reorder within the same active/inactive group.
    const group = campaign.is_active ? activeCampaigns : inactiveCampaigns;
    const idx = group.findIndex((c) => c.id === campaignId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;

    const newGroup = [...group];
    [newGroup[idx], newGroup[swapIdx]] = [newGroup[swapIdx], newGroup[idx]];

    // Reassign sort_order values within the group.
    const updatedGroup = newGroup.map((c, i) => ({ ...c, sort_order: i }));

    // Merge back with the other group and sort.
    const otherGroup = campaign.is_active ? inactiveCampaigns : activeCampaigns;
    const merged = sortCampaigns([...updatedGroup, ...otherGroup]);
    setCampaigns(merged);
    persistOrder(merged);
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)} className="rounded-full">
            {t('list.newCampaign')}
          </Button>
          <CampaignFormDialog
            mode="create"
            open={createOpen}
            onOpenChange={setCreateOpen}
            organizationId={organizationId}
            onSuccess={handleCreated}
          />
        </div>
      )}

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-base font-medium">{t('list.emptyTitle')}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t('list.emptyDescriptionBefore')}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
                /donate/{organizationSlug}/&lt;slug&gt;
              </code>
              {t('list.emptyDescriptionAfter')}
            </p>
            {canManage && (
              <Button
                onClick={() => setCreateOpen(true)}
                className="mt-6 rounded-full"
                variant="default"
              >
                {t('list.createFirst')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(128,128,128,0.3)] text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {canManage && <th className="px-4 py-3">{t('table.order')}</th>}
                    <th className="px-4 py-3">{t('table.campaign')}</th>
                    <th className="px-4 py-3">{t('table.cause')}</th>
                    <th className="px-4 py-3">{t('table.raised')}</th>
                    <th className="px-4 py-3">{t('table.goal')}</th>
                    <th className="px-4 py-3">{t('table.active')}</th>
                    <th className="px-4 py-3 text-right">{t('table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => {
                    const group = campaign.is_active ? activeCampaigns : inactiveCampaigns;
                    const idxInGroup = group.findIndex((c) => c.id === campaign.id);
                    return (
                      <CampaignRow
                        key={campaign.id}
                        campaign={campaign}
                        organizationId={organizationId}
                        organizationSlug={organizationSlug}
                        canManage={canManage}
                        canDelete={canDelete}
                        isFirst={idxInGroup === 0}
                        isLast={idxInGroup === group.length - 1}
                        reordering={reordering}
                        onMove={handleMove}
                        onEdit={() => setEditing(campaign)}
                        onUpdated={handleUpdated}
                        onDeleted={handleDeleted}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {editing && (
        <CampaignFormDialog
          mode="edit"
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          organizationId={organizationId}
          campaign={editing}
          onSuccess={(updated) => {
            handleUpdated(updated);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single row — keeps the per-row mutation state local so toggling/deleting
// one campaign doesn't re-render the whole table.
// ---------------------------------------------------------------------------

interface CampaignRowProps {
  campaign: CampaignWithRaised;
  organizationId: string;
  organizationSlug: string;
  canManage: boolean;
  canDelete: boolean;
  isFirst: boolean;
  isLast: boolean;
  reordering: boolean;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onEdit: () => void;
  onUpdated: (campaign: Campaign) => void;
  onDeleted: (id: string) => void;
}

function CampaignRow({
  campaign,
  organizationId,
  organizationSlug,
  canManage,
  canDelete,
  isFirst,
  isLast,
  reordering,
  onMove,
  onEdit,
  onUpdated,
  onDeleted,
}: CampaignRowProps) {
  const t = useTranslations('mosqueAdmin.campaigns');
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  function handleToggleActive(next: boolean) {
    if (!canManage) return;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/organizations/${organizationId}/campaigns/${campaign.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: next }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || t('form.errors.updateFailed'));
        }
        onUpdated(data.campaign);
        toast.success(next ? t('toast.activated') : t('toast.deactivated'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('toast.updateFailed'));
      }
    });
  }

  async function handleDelete() {
    if (!canDelete) return;
    const confirmed = window.confirm(t('confirmDelete', { title: campaign.title }));
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/campaigns/${campaign.id}`,
        { method: 'DELETE' },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t('toast.deleteFailed'));
      }
      onDeleted(campaign.id);
      toast.success(t('toast.deleted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  const donateHref = `/donate/${organizationSlug}/${campaign.slug}`;

  return (
    <tr className="border-b border-[rgba(128,128,128,0.15)] last:border-b-0">
      {canManage && (
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onMove(campaign.id, 'up')}
              disabled={isFirst || reordering || pending}
              className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
              aria-label={t('table.moveUp')}
            >
              <IconArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onMove(campaign.id, 'down')}
              disabled={isLast || reordering || pending}
              className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
              aria-label={t('table.moveDown')}
            >
              <IconArrowDown className="h-4 w-4" />
            </button>
          </div>
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{campaign.title}</span>
          <Link
            href={donateHref}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
          >
            /donate/{organizationSlug}/{campaign.slug} ↗
          </Link>
          {campaign.description && (
            <p className="mt-1 line-clamp-2 max-w-md text-xs text-slate-500 dark:text-slate-400">
              {campaign.description}
            </p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {campaign.cause_type ? (
          <Badge variant="outline">{campaign.cause_type}</Badge>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="font-medium">{formatEuro(campaign.raised_cents)}</span>
        {campaign.goal_amount != null && campaign.goal_amount > 0 && (
          <div className="mt-1">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${Math.min(100, (campaign.raised_cents / campaign.goal_amount) * 100)}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-slate-400">
              {Math.round((campaign.raised_cents / campaign.goal_amount) * 100)}%
            </span>
          </div>
        )}
      </td>
      <td className="px-4 py-3 font-medium">{formatEuro(campaign.goal_amount)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={campaign.is_active}
            disabled={!canManage || pending}
            onCheckedChange={handleToggleActive}
            aria-label={t('table.toggleActiveAria', { title: campaign.title })}
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {campaign.is_active ? t('table.live') : t('table.hidden')}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              disabled={deleting || pending}
            >
              {t('table.edit')}
            </Button>
          )}
          {canDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={handleDelete}
              disabled={deleting || pending}
              title={deleting ? t('table.deleting') : t('table.deleteCampaign')}
              aria-label={t('table.deleteCampaign')}
            >
              <TrashIcon size={16} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
