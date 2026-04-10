'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CampaignsClientProps {
  organizationId: string;
  organizationSlug: string;
  initialCampaigns: Campaign[];
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

export function CampaignsClient({
  organizationId,
  organizationSlug,
  initialCampaigns,
  canManage,
  canDelete,
}: CampaignsClientProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  function handleCreated(created: Campaign) {
    setCampaigns((prev) => [created, ...prev]);
  }

  function handleUpdated(updated: Campaign) {
    setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function handleDeleted(id: string) {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)} className="rounded-full">
            New campaign
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
            <p className="text-base font-medium">No campaigns yet</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Create your first campaign to start accepting donations on{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
                /donate/{organizationSlug}/&lt;slug&gt;
              </code>
              .
            </p>
            {canManage && (
              <Button
                onClick={() => setCreateOpen(true)}
                className="mt-6 rounded-full"
                variant="default"
              >
                Create your first campaign
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
                    <th className="px-4 py-3">Campaign</th>
                    <th className="px-4 py-3">Cause</th>
                    <th className="px-4 py-3">Goal</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <CampaignRow
                      key={campaign.id}
                      campaign={campaign}
                      organizationId={organizationId}
                      organizationSlug={organizationSlug}
                      canManage={canManage}
                      canDelete={canDelete}
                      onEdit={() => setEditing(campaign)}
                      onUpdated={handleUpdated}
                      onDeleted={handleDeleted}
                    />
                  ))}
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
  campaign: Campaign;
  organizationId: string;
  organizationSlug: string;
  canManage: boolean;
  canDelete: boolean;
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
  onEdit,
  onUpdated,
  onDeleted,
}: CampaignRowProps) {
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
          throw new Error(data.error || 'Failed to update campaign');
        }
        onUpdated(data.campaign);
        toast.success(next ? 'Campaign activated' : 'Campaign deactivated');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update');
      }
    });
  }

  async function handleDelete() {
    if (!canDelete) return;
    const confirmed = window.confirm(
      `Delete the campaign "${campaign.title}"? This cannot be undone. Campaigns with existing donations cannot be deleted — deactivate them instead.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/campaigns/${campaign.id}`,
        { method: 'DELETE' },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete campaign');
      }
      onDeleted(campaign.id);
      toast.success('Campaign deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  const donateHref = `/donate/${organizationSlug}/${campaign.slug}`;

  return (
    <tr className="border-b border-[rgba(128,128,128,0.15)] last:border-b-0">
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
      <td className="px-4 py-3 font-medium">{formatEuro(campaign.goal_amount)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={campaign.is_active}
            disabled={!canManage || pending}
            onCheckedChange={handleToggleActive}
            aria-label={`Toggle ${campaign.title} active`}
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {campaign.is_active ? 'Live' : 'Hidden'}
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
              Edit
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={handleDelete}
              disabled={deleting || pending}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
