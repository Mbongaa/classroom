'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleCheckIcon, Clock3Icon, MapPinIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface BookingOffering {
  id: string;
  slug: string;
  sheikh_name: string;
  sheikh_bio: string | null;
  sheikh_avatar_url: string | null;
  price: number;
  duration_minutes: number;
  location: string | null;
  timezone: string;
}

interface BookingClientProps {
  orgSlug: string;
  orgName: string;
  orgLocation: string;
  offerings: BookingOffering[];
}

interface Slot {
  scheduled_at: string;
  label: string;
}

interface AvailabilitySummary {
  weekdays: number[];
  extra_dates: string[];
  blocked_dates: string[];
}

type Step = 'sheikh' | 'datetime' | 'details';

const STEP_ORDER: Step[] = ['sheikh', 'datetime', 'details'];
const STEP_LABELS: Record<Step, string> = {
  sheikh: 'Who',
  datetime: 'When',
  details: 'Details',
};

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface SlotListProps {
  date: Date | undefined;
  slots: Slot[];
  slotsLoading: boolean;
  slotsError: string | null;
  selectedSlot: Slot | null;
  onSelect: (s: Slot) => void;
}

function SlotList({ date, slots, slotsLoading, slotsError, selectedSlot, onSelect }: SlotListProps) {
  if (!date) {
    return (
      <p className="text-center text-xs text-muted-foreground">Pick a date to see available times.</p>
    );
  }
  if (slotsLoading) {
    return <p className="text-center text-xs text-muted-foreground">Loading times…</p>;
  }
  if (slotsError) {
    return <p className="text-center text-xs text-red-500">{slotsError}</p>;
  }
  if (slots.length === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground">No times available on this day.</p>
    );
  }
  return (
    <>
      {slots.map((s) => {
        const active = selectedSlot?.scheduled_at === s.scheduled_at;
        return (
          <Button
            key={s.scheduled_at}
            variant={active ? 'default' : 'outline'}
            onClick={() => onSelect(s)}
            className="w-full shadow-none"
          >
            {s.label}
          </Button>
        );
      })}
    </>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h} hr` : `${h.toFixed(1)} hr`;
}

interface Sheikh {
  name: string;
  bio: string | null;
  avatar: string | null;
  location: string | null;
  offerings: BookingOffering[];
}

const MAX_QUANTITY = 8;

export function BookingClient({ orgSlug, orgName, orgLocation, offerings }: BookingClientProps) {
  const sheikhs = useMemo<Sheikh[]>(() => {
    const map = new Map<string, Sheikh>();
    for (const o of offerings) {
      const key = o.sheikh_name;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          name: o.sheikh_name,
          bio: o.sheikh_bio,
          avatar: o.sheikh_avatar_url,
          location: o.location,
          offerings: [],
        };
        map.set(key, entry);
      }
      entry.offerings.push(o);
    }
    for (const s of map.values()) {
      s.offerings.sort((a, b) => a.duration_minutes - b.duration_minutes);
    }
    return Array.from(map.values());
  }, [offerings]);

  const [selectedSheikhName, setSelectedSheikhName] = useState<string | null>(
    sheikhs[0]?.name ?? null,
  );
  const selectedSheikh = useMemo(
    () => sheikhs.find((s) => s.name === selectedSheikhName) ?? null,
    [sheikhs, selectedSheikhName],
  );

  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(
    sheikhs[0]?.offerings[0]?.id ?? null,
  );
  const selected = useMemo(
    () => offerings.find((o) => o.id === selectedOfferingId) ?? null,
    [offerings, selectedOfferingId],
  );

  // When the sheikh changes, pick their base offering (first = shortest unit)
  // and reset quantity.
  useEffect(() => {
    if (!selectedSheikh) {
      setSelectedOfferingId(null);
      return;
    }
    const belongs = selectedSheikh.offerings.some((o) => o.id === selectedOfferingId);
    if (!belongs) {
      setSelectedOfferingId(selectedSheikh.offerings[0]?.id ?? null);
      setQuantity(1);
    }
  }, [selectedSheikh, selectedOfferingId]);

  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySummary | null>(null);

  const [step, setStep] = useState<Step>('sheikh');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selected || !date) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlot(null);
    const ymd = toYMD(date);
    const totalDuration = selected.duration_minutes * quantity;
    fetch(
      `/api/public/appointment-offerings/${selected.id}/slots?date=${ymd}&duration=${totalDuration}`,
    )
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load availability');
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setSlotsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, date, quantity]);

  useEffect(() => {
    setDate(undefined);
    setSelectedSlot(null);
    setAvailability(null);
    if (!selected) return;
    let cancelled = false;
    fetch(`/api/public/appointment-offerings/${selected.id}/availability-summary`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (!cancelled) setAvailability(data as AvailabilitySummary);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedOfferingId, selected]);

  const isDayUnavailable = useMemo(() => {
    if (!availability) return () => false;
    const weekdays = new Set(availability.weekdays);
    const extras = new Set(availability.extra_dates);
    const blocked = new Set(availability.blocked_dates);
    return (d: Date) => {
      const ymd = toYMD(d);
      if (blocked.has(ymd)) return true;
      if (extras.has(ymd)) return false;
      return !weekdays.has(d.getDay());
    };
  }, [availability]);

  const canContinue = !!selected && !!selectedSlot;

  async function handleBook() {
    if (!selected || !selectedSlot) return;
    if (name.trim().length < 2) {
      toast.error('Please enter your name');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }

    setSubmitting(true);
    try {
      const returnUrl = `${window.location.origin}/book/${orgSlug}/thank-you`;
      const res = await fetch('/api/appointments/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offering_id: selected.id,
          scheduled_at: selectedSlot.scheduled_at,
          quantity,
          customer_name: name.trim(),
          customer_email: email.trim().toLowerCase(),
          customer_phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
          return_url: returnUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Booking failed');
      setSubmitting(false);
    }
  }

  const localDateLabel = date
    ? date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-black text-foreground"
      style={
        {
          '--background': '222.2 84% 4.9%',
          '--foreground': '210 40% 98%',
          '--card': '222.2 84% 4.9%',
          '--card-foreground': '210 40% 98%',
          '--popover': '222.2 84% 4.9%',
          '--popover-foreground': '210 40% 98%',
          '--primary': '210 40% 98%',
          '--primary-foreground': '222.2 47.4% 11.2%',
          '--secondary': '217.2 32.6% 17.5%',
          '--secondary-foreground': '210 40% 98%',
          '--muted': '217.2 32.6% 17.5%',
          '--muted-foreground': '215 20.2% 65.1%',
          '--accent': '217.2 32.6% 17.5%',
          '--accent-foreground': '210 40% 98%',
          '--border': '217.2 32.6% 17.5%',
          '--input': '217.2 32.6% 17.5%',
          '--ring': '212.7 26.8% 83.9%',
        } as React.CSSProperties
      }
    >
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 py-6 md:py-10">
        <header className="mb-4 shrink-0 text-center">
          <h1 className="text-2xl font-semibold md:text-3xl">{orgName}</h1>
          {orgLocation && (
            <p className="mt-1 text-sm text-muted-foreground">{orgLocation}</p>
          )}
        </header>

        {offerings.length > 0 && (
          <div className="mb-4 flex shrink-0 items-center justify-center gap-2">
            {STEP_ORDER.map((s, i) => {
              const currentIdx = STEP_ORDER.indexOf(step);
              const active = i === currentIdx;
              const done = i < currentIdx;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full border text-xs font-medium',
                      active && 'border-foreground bg-foreground text-background',
                      done && 'border-foreground/60 bg-foreground/60 text-background',
                      !active && !done && 'border-muted-foreground/40 text-muted-foreground',
                    )}
                  >
                    {i + 1}
                  </div>
                  <span
                    className={cn(
                      'text-xs',
                      active ? 'font-medium text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {STEP_LABELS[s]}
                  </span>
                  {i < STEP_ORDER.length - 1 && (
                    <div className="h-px w-6 bg-muted-foreground/40 md:w-10" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {offerings.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No appointments are currently available. Please check back later.
            </p>
          </Card>
        ) : step === 'sheikh' ? (
          <Card className="flex min-h-0 flex-1 flex-col gap-0 p-0">
            <CardHeader className="flex h-max shrink-0 justify-center border-b !p-4">
              <CardTitle>Choose who to speak with</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="flex flex-col gap-2">
                {sheikhs.map((s) => {
                  const base = s.offerings[0];
                  if (!base) return null;
                  const active = s.name === selectedSheikhName;
                  const rowQty = active ? quantity : 1;
                  return (
                    <div
                      key={s.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedSheikhName(s.name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedSheikhName(s.name);
                        }
                      }}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                        active
                          ? 'border-foreground bg-background shadow-sm'
                          : 'bg-background/60 hover:bg-background',
                      )}
                    >
                      <Avatar className="h-12 w-12 shrink-0">
                        {s.avatar && <AvatarImage src={s.avatar} />}
                        <AvatarFallback>{initials(s.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.name}</p>
                        {s.location && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPinIcon className="size-3.5 shrink-0" />
                            {s.location}
                          </p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-semibold">
                        {formatPrice(base.price * rowQty)}
                      </p>
                      <select
                        aria-label="Duration"
                        value={rowQty}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          setSelectedSheikhName(s.name);
                          setQuantity(Number(e.target.value));
                        }}
                        className="shrink-0 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {Array.from({ length: MAX_QUANTITY }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {formatDuration(base.duration_minutes * n)}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {selectedSheikh?.bio && (
                <p className="text-xs text-muted-foreground">{selectedSheikh.bio}</p>
              )}
            </CardContent>
            <CardFooter className="shrink-0 border-t px-6 !py-5">
              <Button
                disabled={!selected}
                onClick={() => setStep('datetime')}
                className="w-full md:ml-auto md:w-auto"
              >
                Continue
              </Button>
            </CardFooter>
          </Card>
        ) : step === 'datetime' ? (
          <Card className="flex min-h-0 flex-1 flex-col gap-0 p-0">
            <CardHeader className="flex h-max shrink-0 justify-center border-b !p-4">
              <CardTitle>Pick a date and time</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto p-0 md:flex-row md:overflow-hidden">
              <div className="flex shrink-0 justify-center p-6 md:flex-1 md:overflow-y-auto">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={[
                    { before: new Date(new Date().setHours(0, 0, 0, 0)) },
                    (d) => isDayUnavailable(d),
                  ]}
                  showOutsideDays={false}
                  className="bg-transparent p-0 [--cell-size:2.5rem]"
                  formatters={{
                    formatWeekdayName: (d) => d.toLocaleString('en-US', { weekday: 'short' }),
                  }}
                />
              </div>
              <div className="shrink-0 border-t md:w-48 md:shrink md:overflow-y-auto md:border-l md:border-t-0">
                <div className="flex flex-col gap-2 p-4 md:p-6">
                  <SlotList
                    date={date}
                    slots={slots}
                    slotsLoading={slotsLoading}
                    slotsError={slotsError}
                    selectedSlot={selectedSlot}
                    onSelect={setSelectedSlot}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex shrink-0 flex-col-reverse gap-2 border-t px-6 !py-5 md:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('sheikh')}
                className="w-full md:w-auto"
              >
                Back
              </Button>
              <Button
                disabled={!canContinue}
                onClick={() => setStep('details')}
                className="w-full md:ml-auto md:w-auto"
              >
                Continue
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="flex min-h-0 flex-1 flex-col gap-0 p-0">
            <CardHeader className="shrink-0 border-b !p-4">
              <CardTitle>Your details</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
              {selected && selectedSlot && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {selected.sheikh_avatar_url && (
                        <AvatarImage src={selected.sheikh_avatar_url} />
                      )}
                      <AvatarFallback>{initials(selected.sheikh_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{selected.sheikh_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {localDateLabel} · {selectedSlot.label} ({selected.timezone})
                      </p>
                    </div>
                    <p className="font-semibold">{formatPrice(selected.price * quantity)}</p>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3Icon className="size-3.5" />
                    {formatDuration(selected.duration_minutes * quantity)}
                    {selected.location ? (
                      <>
                        <span className="mx-1">·</span>
                        <MapPinIcon className="size-3.5" />
                        {selected.location}
                      </>
                    ) : null}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="+31 …"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Anything you&apos;d like to share? (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
              </div>
            </CardContent>
            <CardFooter className="flex shrink-0 flex-col-reverse gap-2 border-t px-6 !py-5 md:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('datetime')}
                disabled={submitting}
                className="w-full md:w-auto"
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleBook}
                disabled={submitting}
                className="w-full md:ml-auto md:w-auto"
              >
                {submitting ? 'Redirecting…' : `Pay ${selected ? formatPrice(selected.price * quantity) : ''}`}
              </Button>
            </CardFooter>
          </Card>
        )}

        <p className="mt-3 shrink-0 text-center text-xs text-muted-foreground">
          Secure payment via Pay.nl
        </p>
      </main>
    </div>
  );
}
