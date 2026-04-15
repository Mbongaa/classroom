'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
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
import { Switch } from '@/components/ui/switch';
import { TrashIcon } from '@/components/ui/trash';
import type { Offering } from './AppointmentsClient';

interface AvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  offering: Offering;
  canManage: boolean;
}

type WeeklyRule = {
  clientId: string;
  kind: 'weekly';
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type OverrideRule = {
  clientId: string;
  kind: 'date_override';
  specific_date: string;
  start_time: string | null;
  end_time: string | null;
  is_blocking: boolean;
};

interface ApiRule {
  id: string;
  offering_id: string;
  kind: 'weekly' | 'date_override';
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_blocking: boolean;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function genId(): string {
  return Math.random().toString(36).slice(2);
}

function stripSeconds(time: string | null): string | null {
  if (!time) return time;
  return time.length > 5 ? time.slice(0, 5) : time;
}

export function AvailabilityDialog({
  open,
  onOpenChange,
  organizationId,
  offering,
  canManage,
}: AvailabilityDialogProps) {
  const [weekly, setWeekly] = useState<WeeklyRule[]>([]);
  const [overrides, setOverrides] = useState<OverrideRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${organizationId}/appointment-offerings/${offering.id}/availability`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load availability');
        if (cancelled) return;
        const apiRules: ApiRule[] = data.rules ?? [];
        setWeekly(
          apiRules
            .filter((r) => r.kind === 'weekly' && r.day_of_week != null)
            .map((r) => ({
              clientId: genId(),
              kind: 'weekly',
              day_of_week: r.day_of_week as number,
              start_time: stripSeconds(r.start_time) || '09:00',
              end_time: stripSeconds(r.end_time) || '17:00',
            })),
        );
        setOverrides(
          apiRules
            .filter((r) => r.kind === 'date_override' && r.specific_date)
            .map((r) => ({
              clientId: genId(),
              kind: 'date_override',
              specific_date: r.specific_date as string,
              start_time: stripSeconds(r.start_time),
              end_time: stripSeconds(r.end_time),
              is_blocking: r.is_blocking,
            })),
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load availability');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId, offering.id]);

  function addWeekly() {
    setWeekly((prev) => [
      ...prev,
      {
        clientId: genId(),
        kind: 'weekly',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00',
      },
    ]);
  }

  function updateWeekly(clientId: string, patch: Partial<WeeklyRule>) {
    setWeekly((prev) => prev.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)));
  }

  function removeWeekly(clientId: string) {
    setWeekly((prev) => prev.filter((r) => r.clientId !== clientId));
  }

  function addOverride() {
    const today = new Date().toISOString().slice(0, 10);
    setOverrides((prev) => [
      ...prev,
      {
        clientId: genId(),
        kind: 'date_override',
        specific_date: today,
        start_time: null,
        end_time: null,
        is_blocking: true,
      },
    ]);
  }

  function updateOverride(clientId: string, patch: Partial<OverrideRule>) {
    setOverrides((prev) =>
      prev.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)),
    );
  }

  function removeOverride(clientId: string) {
    setOverrides((prev) => prev.filter((r) => r.clientId !== clientId));
  }

  async function handleSave() {
    setError('');

    // Client-side validation
    for (const r of weekly) {
      if (!r.start_time || !r.end_time || r.start_time >= r.end_time) {
        setError(`Weekly slot on ${DAY_LABELS[r.day_of_week]} needs a valid time range.`);
        return;
      }
    }
    for (const r of overrides) {
      if (!r.specific_date) {
        setError('Each date override needs a specific date.');
        return;
      }
      if (r.start_time && r.end_time && r.start_time >= r.end_time) {
        setError(`Date override on ${r.specific_date} has an invalid time range.`);
        return;
      }
    }

    const payload = {
      rules: [
        ...weekly.map((r) => ({
          kind: 'weekly' as const,
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
        })),
        ...overrides.map((r) => ({
          kind: 'date_override' as const,
          specific_date: r.specific_date,
          start_time: r.start_time,
          end_time: r.end_time,
          is_blocking: r.is_blocking,
        })),
      ],
    };

    setSaving(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/appointment-offerings/${offering.id}/availability`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      toast.success('Availability saved');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Availability — {offering.sheikh_name}</DialogTitle>
          <DialogDescription>
            Recurring weekly slots are the base schedule. Date overrides can block a day or add a
            one-off slot. Times are interpreted in {offering.timezone}.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Loading…</div>
        ) : (
          <div className="space-y-6">
            {/* Weekly */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Weekly availability</h3>
                {canManage && (
                  <Button type="button" size="sm" variant="outline" onClick={addWeekly}>
                    Add weekly slot
                  </Button>
                )}
              </div>
              {weekly.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
                  No recurring slots. Add one above.
                </p>
              ) : (
                <div className="space-y-2">
                  {weekly.map((r) => (
                    <div
                      key={r.clientId}
                      className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <div className="flex-1 min-w-[120px] space-y-1">
                        <Label className="text-xs">Day</Label>
                        <select
                          value={r.day_of_week}
                          onChange={(e) =>
                            updateWeekly(r.clientId, { day_of_week: Number(e.target.value) })
                          }
                          disabled={!canManage}
                          className="h-9 w-full rounded-md border border-slate-200 bg-transparent px-2 text-sm dark:border-slate-700"
                        >
                          {DAY_LABELS.map((label, i) => (
                            <option key={i} value={i}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[110px] space-y-1">
                        <Label className="text-xs">Start</Label>
                        <Input
                          type="time"
                          value={r.start_time}
                          onChange={(e) =>
                            updateWeekly(r.clientId, { start_time: e.target.value })
                          }
                          disabled={!canManage}
                        />
                      </div>
                      <div className="flex-1 min-w-[110px] space-y-1">
                        <Label className="text-xs">End</Label>
                        <Input
                          type="time"
                          value={r.end_time}
                          onChange={(e) =>
                            updateWeekly(r.clientId, { end_time: e.target.value })
                          }
                          disabled={!canManage}
                        />
                      </div>
                      {canManage && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                          onClick={() => removeWeekly(r.clientId)}
                          aria-label="Remove weekly slot"
                        >
                          <TrashIcon size={16} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Date overrides */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Specific date overrides</h3>
                {canManage && (
                  <Button type="button" size="sm" variant="outline" onClick={addOverride}>
                    Add override
                  </Button>
                )}
              </div>
              {overrides.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
                  No date overrides. Add one to block a holiday or open a one-off slot.
                </p>
              ) : (
                <div className="space-y-2">
                  {overrides.map((r) => (
                    <div
                      key={r.clientId}
                      className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[140px] space-y-1">
                          <Label className="text-xs">Date</Label>
                          <Input
                            type="date"
                            value={r.specific_date}
                            onChange={(e) =>
                              updateOverride(r.clientId, { specific_date: e.target.value })
                            }
                            disabled={!canManage}
                          />
                        </div>
                        <div className="flex items-center gap-2 pb-1">
                          <Switch
                            checked={r.is_blocking}
                            onCheckedChange={(v) => updateOverride(r.clientId, { is_blocking: v })}
                            disabled={!canManage}
                            id={`blk-${r.clientId}`}
                          />
                          <Label htmlFor={`blk-${r.clientId}`} className="text-xs">
                            {r.is_blocking ? 'Block' : 'Add extra slot'}
                          </Label>
                        </div>
                        {canManage && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                            onClick={() => removeOverride(r.clientId)}
                            aria-label="Remove override"
                          >
                            <TrashIcon size={16} />
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[110px] space-y-1">
                          <Label className="text-xs">Start (optional)</Label>
                          <Input
                            type="time"
                            value={r.start_time ?? ''}
                            onChange={(e) =>
                              updateOverride(r.clientId, {
                                start_time: e.target.value || null,
                              })
                            }
                            disabled={!canManage}
                          />
                        </div>
                        <div className="flex-1 min-w-[110px] space-y-1">
                          <Label className="text-xs">End (optional)</Label>
                          <Input
                            type="time"
                            value={r.end_time ?? ''}
                            onChange={(e) =>
                              updateOverride(r.clientId, {
                                end_time: e.target.value || null,
                              })
                            }
                            disabled={!canManage}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {r.is_blocking
                          ? r.start_time && r.end_time
                            ? `Blocks ${r.start_time}–${r.end_time} on this day.`
                            : 'Blocks the entire day.'
                          : r.start_time && r.end_time
                            ? `Adds ${r.start_time}–${r.end_time} on this day on top of weekly rules.`
                            : 'Needs a start and end time to add an extra slot.'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          {canManage && (
            <Button type="button" onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save availability'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
