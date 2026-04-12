'use client';

import { useState, useTransition } from 'react';
import toast from 'react-hot-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThankYouAnimationPlayer } from '@/components/thankyou-animation';
import {
  DEFAULT_THANK_YOU_ANIMATION_ID,
  groupAnimationsByCategory,
  type ThankYouAnimation,
} from '@/lib/thankyou-animations';
import { IconExternalLink } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

/**
 * Organization settings tabs.
 *
 * Currently has two tabs:
 *   - General — read-only org info (Phase 2.5 will make this editable)
 *   - Thank-you animation — picker grid; click an animation, immediate save
 *
 * The animation tab is the focus right now: a 3-column grid of all available
 * Lottie animations from the catalog, with the currently-selected one
 * highlighted. Clicking an animation calls PATCH
 * /api/organizations/[id]/donation-settings with the new id, optimistically
 * updates local state, and toasts on success or rolls back on failure.
 *
 * Adding new tabs (notifications, branding, payouts...) is one TabsTrigger +
 * TabsContent pair away.
 */

interface OrganizationProp {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  country: string;
  contact_email: string | null;
  thankyou_animation_id: string | null;
}

interface SettingsTabsProps {
  organization: OrganizationProp;
}

const CATEGORY_LABELS: Record<ThankYouAnimation['category'], string> = {
  celebration: 'Celebration',
  islamic: 'Islamic',
  charity: 'Charity',
};

export function SettingsTabs({ organization }: SettingsTabsProps) {
  return (
    <Tabs defaultValue="animation" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="animation">Thank-You Animation</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralPanel organization={organization} />
      </TabsContent>

      <TabsContent value="animation">
        <AnimationPanel organization={organization} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// General tab — read-only org info for now
// ---------------------------------------------------------------------------

function GeneralPanel({ organization }: { organization: OrganizationProp }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">General information</CardTitle>
        <CardDescription>
          Basic details about your organization. Editing will be available in a future update.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Field label="Name" value={organization.name} />
        <Field label="Slug" value={organization.slug} mono />
        <Field label="City" value={organization.city || '—'} />
        <Field label="Country" value={organization.country} />
        <Field label="Contact email" value={organization.contact_email || '—'} />
        {organization.description && (
          <Field label="Description" value={organization.description} multiline />
        )}

        <div className="pt-2">
          <a
            href={`/donate/${organization.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400"
          >
            <IconExternalLink className="h-4 w-4" />
            View donate landing page
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
      <div className="text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={cn(
          'sm:col-span-2',
          mono && 'font-mono text-xs',
          multiline && 'whitespace-pre-wrap',
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animation tab — picker grid
// ---------------------------------------------------------------------------

function AnimationPanel({ organization }: { organization: OrganizationProp }) {
  const [selectedId, setSelectedId] = useState<string>(
    organization.thankyou_animation_id || DEFAULT_THANK_YOU_ANIMATION_ID,
  );
  const [, startTransition] = useTransition();
  const groups = groupAnimationsByCategory();

  function handleSelect(animationId: string) {
    if (animationId === selectedId) return;

    const previous = selectedId;
    setSelectedId(animationId); // optimistic

    startTransition(async () => {
      try {
        const res = await fetch(`/api/organizations/${organization.id}/donation-settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thankyou_animation_id: animationId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update animation');
        }
        toast.success('Thank-you animation updated');
      } catch (err) {
        setSelectedId(previous); // rollback
        toast.error(err instanceof Error ? err.message : 'Failed to save');
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Thank-you animation</CardTitle>
        <CardDescription>
          Choose the animation donors will see after completing a successful donation. The
          cancelled-donation page is the same for everyone and is not configurable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {(Object.keys(groups) as Array<ThankYouAnimation['category']>).map((category) => {
          const items = groups[category];
          if (items.length === 0) return null;
          return (
            <section key={category}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {CATEGORY_LABELS[category]}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((anim) => {
                  const isSelected = anim.id === selectedId;
                  return (
                    <button
                      key={anim.id}
                      type="button"
                      onClick={() => handleSelect(anim.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        'group relative flex flex-col items-center rounded-lg border bg-white p-4 text-center transition-all hover:shadow-md dark:bg-black',
                        isSelected
                          ? 'border-black ring-2 ring-black/20 dark:border-white dark:ring-white/20'
                          : 'border-[rgba(128,128,128,0.3)]',
                      )}
                    >
                      {isSelected && (
                        <span className="absolute right-2 top-2 rounded-full bg-black px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white dark:bg-white dark:text-black">
                          Selected
                        </span>
                      )}
                      <ThankYouAnimationPlayer
                        kind="paid"
                        animationId={anim.id}
                        size={120}
                        loop
                      />
                      <p className="mt-2 text-sm font-medium">{anim.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {anim.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
