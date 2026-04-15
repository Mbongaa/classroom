'use client';

import { useState, useTransition } from 'react';
import toast from 'react-hot-toast';
import { IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TrashIcon } from '@/components/ui/trash';
import { OfferingFormDialog } from './OfferingFormDialog';
import { AvailabilityDialog } from './AvailabilityDialog';

export interface Offering {
  id: string;
  organization_id: string;
  slug: string;
  sheikh_name: string;
  sheikh_email: string;
  sheikh_bio: string | null;
  sheikh_avatar_url: string | null;
  price: number;
  duration_minutes: number;
  location: string | null;
  timezone: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  offering_id: string;
  organization_id: string;
  scheduled_at: string;
  duration_minutes: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  notes: string | null;
  transaction_id: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  offering: { id: string; sheikh_name: string; slug: string; price: number } | null;
}

interface AppointmentsClientProps {
  organizationId: string;
  organizationSlug: string;
  initialOfferings: Offering[];
  initialAppointments: Appointment[];
  canManage: boolean;
  canDelete: boolean;
}

function formatEuro(cents: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );
}

function sortOfferings(list: Offering[]): Offering[] {
  return [...list].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function AppointmentsClient({
  organizationId,
  organizationSlug,
  initialOfferings,
  initialAppointments,
  canManage,
  canDelete,
}: AppointmentsClientProps) {
  const [offerings, setOfferings] = useState<Offering[]>(initialOfferings);
  const [appointments] = useState<Appointment[]>(initialAppointments);
  const [editing, setEditing] = useState<Offering | null>(null);
  const [editingAvailability, setEditingAvailability] = useState<Offering | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reordering, setReordering] = useState(false);

  const activeOfferings = offerings.filter((o) => o.is_active);
  const inactiveOfferings = offerings.filter((o) => !o.is_active);

  function handleCreated(created: Offering) {
    setOfferings((prev) => sortOfferings([created, ...prev]));
  }

  function handleUpdated(updated: Offering) {
    setOfferings((prev) => sortOfferings(prev.map((o) => (o.id === updated.id ? updated : o))));
  }

  function handleDeleted(id: string) {
    setOfferings((prev) => prev.filter((o) => o.id !== id));
  }

  async function persistOrder(reordered: Offering[]) {
    setReordering(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/appointment-offerings/reorder`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offering_ids: reordered.map((o) => o.id) }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to reorder');
      }
      toast.success('Order updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reorder');
    } finally {
      setReordering(false);
    }
  }

  function handleMove(offeringId: string, direction: 'up' | 'down') {
    const offering = offerings.find((o) => o.id === offeringId);
    if (!offering) return;

    const group = offering.is_active ? activeOfferings : inactiveOfferings;
    const idx = group.findIndex((o) => o.id === offeringId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;

    const newGroup = [...group];
    [newGroup[idx], newGroup[swapIdx]] = [newGroup[swapIdx], newGroup[idx]];

    const updatedGroup = newGroup.map((o, i) => ({ ...o, sort_order: i }));
    const otherGroup = offering.is_active ? inactiveOfferings : activeOfferings;
    const merged = sortOfferings([...updatedGroup, ...otherGroup]);
    setOfferings(merged);
    persistOrder(merged);
  }

  const pendingCount = appointments.filter((a) => a.status === 'pending').length;
  const upcomingCount = appointments.filter(
    (a) => a.status === 'confirmed' && new Date(a.scheduled_at) >= new Date(),
  ).length;

  return (
    <Tabs defaultValue="offerings" className="space-y-6">
      <TabsList>
        <TabsTrigger value="offerings">Offerings ({offerings.length})</TabsTrigger>
        <TabsTrigger value="bookings">
          Bookings ({upcomingCount} upcoming
          {pendingCount > 0 ? ` · ${pendingCount} pending` : ''})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="offerings" className="space-y-6">
        {canManage && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Public booking link:{' '}
              <code className="text-xs">/book/{organizationSlug}</code>
            </p>
            <Button onClick={() => setCreateOpen(true)} className="rounded-full">
              New offering
            </Button>
          </div>
        )}

        <OfferingFormDialog
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          organizationId={organizationId}
          onSuccess={handleCreated}
        />

        {offerings.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-base font-medium">No offerings yet</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Add a sheikh and their session price to start accepting bookings.
              </p>
              {canManage && (
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="mt-6 rounded-full"
                  variant="default"
                >
                  Add first offering
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
                      {canManage && <th className="px-4 py-3">Order</th>}
                      <th className="px-4 py-3">Sheikh</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Active</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offerings.map((offering) => {
                      const group = offering.is_active ? activeOfferings : inactiveOfferings;
                      const idxInGroup = group.findIndex((o) => o.id === offering.id);
                      return (
                        <OfferingRow
                          key={offering.id}
                          offering={offering}
                          organizationId={organizationId}
                          canManage={canManage}
                          canDelete={canDelete}
                          isFirst={idxInGroup === 0}
                          isLast={idxInGroup === group.length - 1}
                          reordering={reordering}
                          onMove={handleMove}
                          onEdit={() => setEditing(offering)}
                          onEditAvailability={() => setEditingAvailability(offering)}
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
          <OfferingFormDialog
            mode="edit"
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            organizationId={organizationId}
            offering={editing}
            onSuccess={(updated) => {
              handleUpdated(updated);
              setEditing(null);
            }}
          />
        )}

        {editingAvailability && (
          <AvailabilityDialog
            open={editingAvailability !== null}
            onOpenChange={(open) => !open && setEditingAvailability(null)}
            organizationId={organizationId}
            offering={editingAvailability}
            canManage={canManage}
          />
        )}
      </TabsContent>

      <TabsContent value="bookings" className="space-y-6">
        <BookingsTable appointments={appointments} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Offering row
// ---------------------------------------------------------------------------

interface OfferingRowProps {
  offering: Offering;
  organizationId: string;
  canManage: boolean;
  canDelete: boolean;
  isFirst: boolean;
  isLast: boolean;
  reordering: boolean;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onEdit: () => void;
  onEditAvailability: () => void;
  onUpdated: (offering: Offering) => void;
  onDeleted: (id: string) => void;
}

function OfferingRow({
  offering,
  organizationId,
  canManage,
  canDelete,
  isFirst,
  isLast,
  reordering,
  onMove,
  onEdit,
  onEditAvailability,
  onUpdated,
  onDeleted,
}: OfferingRowProps) {
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  function handleToggleActive(next: boolean) {
    if (!canManage) return;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/organizations/${organizationId}/appointment-offerings/${offering.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: next }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update');
        }
        onUpdated(data.offering);
        toast.success(next ? 'Offering activated' : 'Offering deactivated');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update');
      }
    });
  }

  async function handleDelete() {
    if (!canDelete) return;
    const confirmed = window.confirm(
      `Delete "${offering.sheikh_name}"? This cannot be undone. Offerings with existing bookings cannot be deleted — deactivate them instead.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/appointment-offerings/${offering.id}`,
        { method: 'DELETE' },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete');
      }
      onDeleted(offering.id);
      toast.success('Offering deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <tr className="border-b border-[rgba(128,128,128,0.15)] last:border-b-0">
      {canManage && (
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onMove(offering.id, 'up')}
              disabled={isFirst || reordering || pending}
              className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
              aria-label="Move up"
            >
              <IconArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onMove(offering.id, 'down')}
              disabled={isLast || reordering || pending}
              className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
              aria-label="Move down"
            >
              <IconArrowDown className="h-4 w-4" />
            </button>
          </div>
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {offering.sheikh_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={offering.sheikh_avatar_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {offering.sheikh_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{offering.sheikh_name}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {offering.sheikh_email}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-medium">{formatEuro(offering.price)}</td>
      <td className="px-4 py-3">
        <Badge variant="outline">{offering.duration_minutes} min</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={offering.is_active}
            disabled={!canManage || pending}
            onCheckedChange={handleToggleActive}
            aria-label={`Toggle ${offering.sheikh_name}`}
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {offering.is_active ? 'Live' : 'Hidden'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          {canManage && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={onEditAvailability}
                disabled={deleting || pending}
              >
                Availability
              </Button>
              <Button size="sm" variant="outline" onClick={onEdit} disabled={deleting || pending}>
                Edit
              </Button>
            </>
          )}
          {canDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={handleDelete}
              disabled={deleting || pending}
              title="Delete offering"
              aria-label="Delete offering"
            >
              <TrashIcon size={16} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Bookings table
// ---------------------------------------------------------------------------

function BookingsTable({ appointments }: { appointments: Appointment[] }) {
  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-base font-medium">No bookings yet</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Bookings will appear here as soon as customers book a session.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(128,128,128,0.3)] text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Sheikh</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => (
                <tr
                  key={appt.id}
                  className="border-b border-[rgba(128,128,128,0.15)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {new Date(appt.scheduled_at).toLocaleDateString('nl-NL', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(appt.scheduled_at).toLocaleTimeString('nl-NL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {appt.duration_minutes} min
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{appt.offering?.sheikh_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{appt.customer_name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {appt.customer_email}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        appt.status === 'confirmed'
                          ? 'default'
                          : appt.status === 'pending'
                            ? 'secondary'
                            : appt.status === 'cancelled'
                              ? 'destructive'
                              : 'outline'
                      }
                    >
                      {appt.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {appt.offering?.price != null ? formatEuro(appt.offering.price) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
