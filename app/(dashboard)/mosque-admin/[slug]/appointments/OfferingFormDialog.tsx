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
import { Switch } from '@/components/ui/switch';
import type { Offering } from './AppointmentsClient';

interface OfferingFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  offering?: Offering;
  onSuccess: (offering: Offering) => void;
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

export function OfferingFormDialog({
  mode,
  open,
  onOpenChange,
  organizationId,
  offering,
  onSuccess,
}: OfferingFormDialogProps) {
  const isEdit = mode === 'edit';

  const [sheikhName, setSheikhName] = useState('');
  const [sheikhEmail, setSheikhEmail] = useState('');
  const [sheikhBio, setSheikhBio] = useState('');
  const [sheikhAvatarUrl, setSheikhAvatarUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [priceEuros, setPriceEuros] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState('Europe/Amsterdam');
  const [isActive, setIsActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (isEdit && offering) {
      setSheikhName(offering.sheikh_name);
      setSheikhEmail(offering.sheikh_email);
      setSheikhBio(offering.sheikh_bio ?? '');
      setSheikhAvatarUrl(offering.sheikh_avatar_url ?? '');
      setSlug(offering.slug);
      setSlugTouched(true);
      setPriceEuros(String(offering.price / 100));
      setDurationMinutes(String(offering.duration_minutes));
      setLocation(offering.location ?? '');
      setTimezone(offering.timezone);
      setIsActive(offering.is_active);
    } else {
      setSheikhName('');
      setSheikhEmail('');
      setSheikhBio('');
      setSheikhAvatarUrl('');
      setSlug('');
      setSlugTouched(false);
      setPriceEuros('');
      setDurationMinutes('30');
      setLocation('');
      setTimezone('Europe/Amsterdam');
      setIsActive(true);
    }
    setError('');
  }, [open, isEdit, offering]);

  function handleNameChange(value: string) {
    setSheikhName(value);
    if (!isEdit && !slugTouched) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedName = sheikhName.trim();
    const trimmedEmail = sheikhEmail.trim().toLowerCase();
    const trimmedSlug = slug.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setError('Sheikh name is required.');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('A valid sheikh email is required.');
      return;
    }
    if (!isEdit && !SLUG_RE.test(trimmedSlug)) {
      setError('Slug must be 3-60 lowercase letters, numbers or hyphens.');
      return;
    }
    const priceNumber = parseFloat(priceEuros);
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      setError('Price must be a positive number.');
      return;
    }
    const durationNumber = parseInt(durationMinutes, 10);
    if (!Number.isFinite(durationNumber) || durationNumber <= 0 || durationNumber > 480) {
      setError('Duration must be between 1 and 480 minutes.');
      return;
    }

    const priceCents = Math.round(priceNumber * 100);

    const body: Record<string, unknown> = {
      sheikh_name: trimmedName,
      sheikh_email: trimmedEmail,
      sheikh_bio: sheikhBio.trim() || null,
      sheikh_avatar_url: sheikhAvatarUrl.trim() || null,
      price: priceCents,
      duration_minutes: durationNumber,
      location: location.trim() || null,
      timezone: timezone.trim(),
      is_active: isActive,
    };

    if (!isEdit) {
      body.slug = trimmedSlug;
    }

    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/organizations/${organizationId}/appointment-offerings/${offering!.id}`
        : `/api/organizations/${organizationId}/appointment-offerings`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Save failed');
      }
      onSuccess(data.offering);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit offering' : 'New offering'}</DialogTitle>
          <DialogDescription>
            A sheikh profile with a fixed session price. Customers book slots on the public
            booking page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sheikh_name">Sheikh name</Label>
            <Input
              id="sheikh_name"
              value={sheikhName}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              maxLength={200}
              placeholder="Sheikh Ahmed"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sheikh_email">
              Sheikh email <span className="text-xs text-slate-500">(for booking notifications)</span>
            </Label>
            <Input
              id="sheikh_email"
              type="email"
              value={sheikhEmail}
              onChange={(e) => setSheikhEmail(e.target.value)}
              required
              placeholder="sheikh@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              required
              disabled={isEdit}
              placeholder="sheikh-ahmed"
              pattern="[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              URL-friendly identifier. {isEdit && 'Cannot be changed after creation.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="price">Price (€)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0.01"
                value={priceEuros}
                onChange={(e) => setPriceEuros(e.target.value)}
                required
                placeholder="25.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (min)</Label>
              <Input
                id="duration"
                type="number"
                step="5"
                min="5"
                max="480"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sheikh_bio">Bio (optional)</Label>
            <Textarea
              id="sheikh_bio"
              value={sheikhBio}
              onChange={(e) => setSheikhBio(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="Short introduction shown on the booking page."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar">Avatar URL (optional)</Label>
            <Input
              id="avatar"
              type="url"
              value={sheikhAvatarUrl}
              onChange={(e) => setSheikhAvatarUrl(e.target.value)}
              maxLength={2000}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={500}
              placeholder="In-person address or meeting details"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              maxLength={80}
              placeholder="Europe/Amsterdam"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              IANA timezone used to interpret weekly availability slots.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visible on the public booking page.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create offering'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
