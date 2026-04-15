import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/public/appointment-offerings/[offeringId]/slots?date=YYYY-MM-DD
 *
 * Public endpoint (no auth) used by the booking widget to populate the time
 * slot column for a specific sheikh + date. Returns all slots that are OPEN
 * for that day based on:
 *
 *   - Weekly availability rules for the offering's day_of_week
 *   - Date overrides (is_blocking=true removes; is_blocking=false adds extra)
 *   - Existing pending/confirmed appointments (subtracted)
 *
 * Time arithmetic uses the offering's IANA timezone. The final `scheduled_at`
 * we send back is the ISO string in UTC, ready to post to /api/appointments/book.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface OfferingRow {
  id: string;
  organization_id: string;
  duration_minutes: number;
  timezone: string;
  is_active: boolean;
}

interface RuleRow {
  kind: 'weekly' | 'date_override';
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_blocking: boolean;
}

interface AppointmentRow {
  scheduled_at: string;
  duration_minutes: number;
}

/** Interval expressed in minutes-from-midnight in the offering timezone. */
interface Interval {
  startMin: number;
  endMin: number;
}

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Build an ISO UTC timestamp for a given YYYY-MM-DD + HH:MM interpreted in the
 * offering's IANA timezone. We compute by asking the Intl formatter what the
 * UTC time "looks like" in that zone, then solving for the offset.
 */
function zonedDateTimeToUtcISO(dateStr: string, hhmm: string, timeZone: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  // First pass: assume the wall-clock time IS UTC, then measure offset at that instant.
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
  const offsetMs = getTimeZoneOffsetMs(new Date(guess), timeZone);
  // Subtract the offset to get the true UTC instant whose local time is the wall clock.
  return new Date(guess - offsetMs).toISOString();
}

/** Returns the offset (tz local - UTC) in ms for a given instant in a zone. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour === 24 ? 0 : map.hour,
    map.minute,
    map.second,
  );
  return asUtc - date.getTime();
}

/** Day-of-week 0..6 (Sun..Sat) for a given YYYY-MM-DD in the offering timezone. */
function dayOfWeekInZone(dateStr: string, timeZone: string): number {
  // Noon in the zone is safe against DST edge cases.
  const noonUtc = zonedDateTimeToUtcISO(dateStr, '12:00', timeZone);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(new Date(noonUtc));
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekday] ?? 0;
}

/** Subtract a set of intervals from a base set. All inputs in minutes-from-midnight. */
function subtractIntervals(base: Interval[], remove: Interval[]): Interval[] {
  let current = [...base];
  for (const r of remove) {
    const next: Interval[] = [];
    for (const c of current) {
      if (r.endMin <= c.startMin || r.startMin >= c.endMin) {
        next.push(c);
        continue;
      }
      if (r.startMin > c.startMin) next.push({ startMin: c.startMin, endMin: r.startMin });
      if (r.endMin < c.endMin) next.push({ startMin: r.endMin, endMin: c.endMin });
    }
    current = next;
  }
  return current;
}

/** Merge overlapping/adjacent intervals. */
function mergeIntervals(ivals: Interval[]): Interval[] {
  if (ivals.length === 0) return [];
  const sorted = [...ivals].sort((a, b) => a.startMin - b.startMin);
  const out: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, cur.endMin);
    } else {
      out.push(cur);
    }
  }
  return out;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offeringId: string }> },
) {
  const { offeringId } = await params;
  if (!UUID_RE.test(offeringId)) {
    return NextResponse.json({ error: 'Invalid offering id' }, { status: 400 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get('date');
  if (!dateParam || !DATE_RE.test(dateParam)) {
    return NextResponse.json({ error: 'date=YYYY-MM-DD required' }, { status: 400 });
  }
  const durationParam = url.searchParams.get('duration');

  const supabaseAdmin = createAdminClient();

  const { data: offering } = await supabaseAdmin
    .from('appointment_offerings')
    .select<string, OfferingRow>('id, organization_id, duration_minutes, timezone, is_active')
    .eq('id', offeringId)
    .eq('is_active', true)
    .single();

  if (!offering) {
    return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
  }

  const { duration_minutes: baseDuration, timezone } = offering;

  // Clients can request a longer session as an integer multiple of the base
  // unit (e.g. 2 × 60min = 120min). The slot grid then steps by that size.
  let duration = baseDuration;
  if (durationParam != null) {
    const parsed = Number(durationParam);
    if (
      !Number.isFinite(parsed) ||
      !Number.isInteger(parsed) ||
      parsed <= 0 ||
      parsed % baseDuration !== 0
    ) {
      return NextResponse.json(
        { error: `duration must be a positive multiple of ${baseDuration}` },
        { status: 400 },
      );
    }
    duration = parsed;
  }

  const dow = dayOfWeekInZone(dateParam, timezone);

  const { data: rules } = await supabaseAdmin
    .from('appointment_availability_rules')
    .select<string, RuleRow>('kind, day_of_week, specific_date, start_time, end_time, is_blocking')
    .eq('offering_id', offeringId);

  const ruleList = rules ?? [];

  // Base availability from weekly rules for this day-of-week
  const weeklyWindows: Interval[] = ruleList
    .filter((r) => r.kind === 'weekly' && r.day_of_week === dow && r.start_time && r.end_time)
    .map((r) => ({
      startMin: parseTimeToMinutes(r.start_time!.slice(0, 5)),
      endMin: parseTimeToMinutes(r.end_time!.slice(0, 5)),
    }));

  // Add extra windows from non-blocking date overrides for this date
  const extraWindows: Interval[] = ruleList
    .filter(
      (r) =>
        r.kind === 'date_override' &&
        r.specific_date === dateParam &&
        !r.is_blocking &&
        r.start_time &&
        r.end_time,
    )
    .map((r) => ({
      startMin: parseTimeToMinutes(r.start_time!.slice(0, 5)),
      endMin: parseTimeToMinutes(r.end_time!.slice(0, 5)),
    }));

  let windows = mergeIntervals([...weeklyWindows, ...extraWindows]);

  // Subtract blocking date overrides
  const blockingOverrides = ruleList.filter(
    (r) => r.kind === 'date_override' && r.specific_date === dateParam && r.is_blocking,
  );
  for (const block of blockingOverrides) {
    if (!block.start_time || !block.end_time) {
      // Full-day block — no slots.
      windows = [];
      break;
    }
    windows = subtractIntervals(windows, [
      {
        startMin: parseTimeToMinutes(block.start_time.slice(0, 5)),
        endMin: parseTimeToMinutes(block.end_time.slice(0, 5)),
      },
    ]);
  }

  if (windows.length === 0) {
    return NextResponse.json({ slots: [], timezone, duration_minutes: duration });
  }

  // Fetch existing pending/confirmed appointments in the day (tz-local) and
  // carve those out. Use a broad UTC range to be safe around DST.
  const dayStartUtc = zonedDateTimeToUtcISO(dateParam, '00:00', timezone);
  const nextDay = new Date(dayStartUtc);
  nextDay.setUTCDate(nextDay.getUTCDate() + 2); // +48h covers any DST shift
  const rangeEndUtc = nextDay.toISOString();

  const { data: booked } = await supabaseAdmin
    .from('appointments')
    .select<string, AppointmentRow>('scheduled_at, duration_minutes')
    .eq('offering_id', offeringId)
    .in('status', ['pending', 'confirmed'])
    .gte('scheduled_at', dayStartUtc)
    .lt('scheduled_at', rangeEndUtc);

  const bookedIntervals: Interval[] = [];
  for (const a of booked ?? []) {
    const local = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(a.scheduled_at));
    const map: Record<string, string> = {};
    for (const p of local) if (p.type !== 'literal') map[p.type] = p.value;
    if (`${map.year}-${map.month}-${map.day}` !== dateParam) continue;
    const startMin = Number(map.hour) * 60 + Number(map.minute);
    bookedIntervals.push({ startMin, endMin: startMin + a.duration_minutes });
  }

  // Generate slots of `duration` minutes, step = duration, skip if overlapping
  // a booked interval.
  const now = Date.now();
  const slots: { scheduled_at: string; label: string }[] = [];
  for (const w of windows) {
    for (let t = w.startMin; t + duration <= w.endMin; t += duration) {
      const slot: Interval = { startMin: t, endMin: t + duration };
      const conflict = bookedIntervals.some(
        (b) => !(slot.endMin <= b.startMin || slot.startMin >= b.endMin),
      );
      if (conflict) continue;
      const hhmm = formatMinutes(t);
      const iso = zonedDateTimeToUtcISO(dateParam, hhmm, timezone);
      if (new Date(iso).getTime() <= now) continue; // no past slots
      slots.push({ scheduled_at: iso, label: hhmm });
    }
  }

  return NextResponse.json({
    slots,
    timezone,
    duration_minutes: duration,
  });
}
