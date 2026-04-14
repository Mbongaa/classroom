'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CAMPAIGN_ICONS } from '@/lib/campaign-icons';
import { LottieIcon } from '@/components/lottie-icon';
import { cn } from '@/lib/utils';
import type { Campaign } from './CampaignsClient';

/**
 * Create / edit dialog for a campaign. The same component handles both
 * modes — `mode='edit'` pre-fills from the passed `campaign` and POSTs to
 * the [campaignId] PATCH route, otherwise it POSTs to the collection
 * endpoint.
 *
 * `slug` is locked in edit mode. Changing a slug would break any donate
 * links that have already been shared, so we disallow it from the UI. (The
 * API still accepts slug updates for superadmin use via curl.)
 *
 * Goal amount is collected in EUROS for the user but converted to CENTS
 * before being sent to the API, since the database stores cents.
 */

interface CampaignFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  campaign?: Campaign;
  onSuccess: (campaign: Campaign) => void;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function CampaignFormDialog({
  mode,
  open,
  onOpenChange,
  organizationId,
  campaign,
  onSuccess,
}: CampaignFormDialogProps) {
  const isEdit = mode === 'edit';

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [causeType, setCauseType] = useState('');
  const [goalEuros, setGoalEuros] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset / hydrate whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (isEdit && campaign) {
      setTitle(campaign.title);
      setSlug(campaign.slug);
      setSlugTouched(true);
      setDescription(campaign.description ?? '');
      setCauseType(campaign.cause_type ?? '');
      setGoalEuros(campaign.goal_amount != null ? String(campaign.goal_amount / 100) : '');
      setSelectedIcon(campaign.icon ?? null);
      setIsActive(campaign.is_active);
    } else {
      setTitle('');
      setSlug('');
      setSlugTouched(false);
      setDescription('');
      setCauseType('');
      setGoalEuros('');
      setSelectedIcon(null);
      setIsActive(true);
    }
    setError('');
  }, [open, isEdit, campaign]);

  // In create mode, auto-suggest the slug from the title until the user
  // edits the slug field directly.
  function handleTitleChange(value: string) {
    setTitle(value);
    if (!isEdit && !slugTouched) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value.toLowerCase());
    setSlugTouched(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) {
      setError('Title must be at least 2 characters');
      return;
    }
    if (!isEdit && !SLUG_RE.test(slug)) {
      setError(
        'Slug must be 3-60 lowercase letters, numbers or hyphens (no leading/trailing hyphen)',
      );
      return;
    }

    let goalAmountCents: number | null = null;
    if (goalEuros.trim() !== '') {
      const parsed = Number(goalEuros.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('Goal amount must be a non-negative number');
        return;
      }
      goalAmountCents = Math.round(parsed * 100);
    }

    const payload: Record<string, unknown> = {
      title: trimmedTitle,
      description: description.trim() || null,
      cause_type: causeType.trim() || null,
      goal_amount: goalAmountCents,
      icon: selectedIcon || null,
      is_active: isActive,
    };
    // Only send slug on create — see component header for rationale.
    if (!isEdit) {
      payload.slug = slug;
    }

    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/organizations/${organizationId}/campaigns/${campaign!.id}`
        : `/api/organizations/${organizationId}/campaigns`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${isEdit ? 'update' : 'create'} campaign`);
      }
      onSuccess(data.campaign);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[520px]">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{isEdit ? 'Edit campaign' : 'New campaign'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update the details for this donation cause.'
                : 'Create a new donation cause that will appear on your donate page.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 gap-4 overflow-y-auto py-2">
            <div className="grid gap-2">
              <Label htmlFor="campaign-title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="campaign-title"
                placeholder="e.g. Ramadan iftar fund"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                disabled={submitting}
                maxLength={200}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="campaign-slug">
                Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="campaign-slug"
                placeholder="e.g. ramadan-iftar"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                disabled={submitting || isEdit}
                maxLength={60}
                required
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEdit
                  ? 'Slug cannot be changed — it would break links that have already been shared.'
                  : 'Used in the donate URL: /donate/<org>/<slug>. Lowercase letters, numbers and hyphens.'}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="campaign-description">Description</Label>
              <Textarea
                id="campaign-description"
                placeholder="What does this campaign support? Optional."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                maxLength={5000}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="campaign-cause">Cause type</Label>
                <Input
                  id="campaign-cause"
                  placeholder="zakat, sadaqah…"
                  value={causeType}
                  onChange={(e) => setCauseType(e.target.value)}
                  disabled={submitting}
                  maxLength={50}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Free-text tag used for reporting.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campaign-goal">Goal (€)</Label>
                <Input
                  id="campaign-goal"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  placeholder="Optional"
                  value={goalEuros}
                  onChange={(e) => setGoalEuros(e.target.value)}
                  disabled={submitting}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Leave blank if no fixed goal.
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-5 gap-2">
                {/* No-icon option */}
                <button
                  type="button"
                  onClick={() => setSelectedIcon(null)}
                  disabled={submitting}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border-2 p-2 transition-colors',
                    selectedIcon === null
                      ? 'border-black bg-slate-50 dark:border-white dark:bg-slate-900/60'
                      : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600',
                  )}
                >
                  <div className="flex h-[50px] w-[50px] items-center justify-center text-slate-400">
                    <span className="text-lg">—</span>
                  </div>
                  <span className="mt-1 text-[10px] text-slate-500">None</span>
                </button>
                {CAMPAIGN_ICONS.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedIcon(entry.id)}
                    disabled={submitting}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-lg border-2 p-2 transition-colors',
                      selectedIcon === entry.id
                        ? 'border-black bg-slate-50 dark:border-white dark:bg-slate-900/60'
                        : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600',
                    )}
                  >
                    <LottieIcon src={entry.file} size={50} />
                    <span className="mt-1 text-[10px] text-slate-500">{entry.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Shown on the donate page when this campaign is selected.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-[rgba(128,128,128,0.3)] p-3">
              <input
                id="campaign-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={submitting}
                className="h-4 w-4"
              />
              <Label htmlFor="campaign-active" className="cursor-pointer text-sm font-normal">
                Active — visible on the donate page and accepting donations
              </Label>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-full">
              {submitting
                ? isEdit
                  ? 'Saving…'
                  : 'Creating…'
                : isEdit
                  ? 'Save changes'
                  : 'Create campaign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
