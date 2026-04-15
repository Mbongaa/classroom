import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/public/appointment-offerings/[offeringId]/availability-summary
 *
 * Returns the set of weekdays (0..6, Sun..Sat) the offering has any weekly
 * rule for, plus the list of dates fully blocked by date overrides. The
 * booking widget uses this to gray out days with no possibility of an
 * appointment, without computing every slot in every visible month.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RuleRow {
  kind: 'weekly' | 'date_override';
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_blocking: boolean;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ offeringId: string }> },
) {
  const { offeringId } = await params;
  if (!UUID_RE.test(offeringId)) {
    return NextResponse.json({ error: 'Invalid offering id' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: offering } = await supabaseAdmin
    .from('appointment_offerings')
    .select('id')
    .eq('id', offeringId)
    .eq('is_active', true)
    .single();

  if (!offering) {
    return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
  }

  const { data: rules } = await supabaseAdmin
    .from('appointment_availability_rules')
    .select<string, RuleRow>('kind, day_of_week, specific_date, start_time, end_time, is_blocking')
    .eq('offering_id', offeringId);

  const ruleList = rules ?? [];

  const weekdaySet = new Set<number>();
  for (const r of ruleList) {
    if (r.kind === 'weekly' && r.day_of_week != null && r.start_time && r.end_time) {
      weekdaySet.add(r.day_of_week);
    }
  }

  // Extra-availability overrides (non-blocking) also enable a specific date
  const extraDates = new Set<string>();
  const blockedDates = new Set<string>();
  for (const r of ruleList) {
    if (r.kind !== 'date_override' || !r.specific_date) continue;
    if (!r.is_blocking && r.start_time && r.end_time) {
      extraDates.add(r.specific_date);
    }
    // Full-day block (no start/end) fully removes the date
    if (r.is_blocking && !r.start_time && !r.end_time) {
      blockedDates.add(r.specific_date);
    }
  }

  return NextResponse.json({
    weekdays: Array.from(weekdaySet).sort(),
    extra_dates: Array.from(extraDates).sort(),
    blocked_dates: Array.from(blockedDates).sort(),
  });
}
