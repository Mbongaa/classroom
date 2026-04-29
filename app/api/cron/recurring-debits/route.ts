import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PayNLError, redactPII, triggerDirectDebit } from '@/lib/paynl';

/**
 * POST/GET /api/cron/recurring-debits
 *
 * Daily Vercel-cron job that triggers the next monthly debit for every
 * ACTIVE mandate whose `next_debit_at` is due. Pay.nl FLEXIBLE mandates
 * do NOT auto-charge monthly — each cycle is an explicit DirectDebits:Add
 * call. Without this job, donors are debited once (the first collection)
 * and then never again.
 *
 * Idempotency:
 *   - The unique index `direct_debits(mandate_id, process_date)` blocks
 *     two parallel runs from queuing duplicate debits for the same slot.
 *   - We insert the `direct_debits` row in PENDING state BEFORE calling
 *     Pay.nl (claiming the slot); on Pay.nl failure we DELETE the row
 *     and bump `next_debit_at` by one day so the cron retries tomorrow.
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` (Vercel cron sets
 * this automatically when CRON_SECRET is configured).
 */

const CRON_SECRET = process.env.CRON_SECRET;

// Pay.nl requires processDate ≥ today + 2 days. We use +3 to give the
// donor's bank one extra calendar day of buffer.
const MIN_LEAD_DAYS = 3;

// One-shot ceiling so a missed-week of cron doesn't fan out into hundreds
// of API calls if next_debit_at backlog has piled up. Higher-priority
// (most overdue) mandates run first.
const MAX_DEBITS_PER_RUN = 200;

interface DueMandate {
  id: string;
  paynl_mandate_id: string;
  paynl_service_id: string;
  monthly_amount: number | null;
  stats_extra1: string | null;
  stats_extra2: string | null;
  stats_extra3: string | null;
  next_debit_at: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + n);
  return out;
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    // Hard-fail in production if the secret was forgotten — better to alert
    // ops than to leave the endpoint open.
    console.error('[Cron recurring-debits] CRON_SECRET not configured; refusing to run.');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error: fetchError } = await supabase
    .from('mandates')
    .select(
      'id, paynl_mandate_id, paynl_service_id, monthly_amount, stats_extra1, stats_extra2, stats_extra3, next_debit_at',
    )
    .eq('status', 'ACTIVE')
    .lte('next_debit_at', nowIso)
    .order('next_debit_at', { ascending: true })
    .limit(MAX_DEBITS_PER_RUN)
    .returns<DueMandate[]>();

  if (fetchError) {
    console.error('[Cron recurring-debits] mandate fetch failed', fetchError);
    return NextResponse.json({ error: 'Failed to load due mandates' }, { status: 500 });
  }

  const mandates = due ?? [];
  const summary = {
    total: mandates.length,
    triggered: 0,
    skipped_already_queued: 0,
    failed_paynl: 0,
    failed_other: 0,
  };

  for (const mandate of mandates) {
    const result = await processOne(supabase, mandate);
    summary[result] += 1;
  }

  console.log('[Cron recurring-debits] run complete', summary);
  return NextResponse.json({ ok: true, ...summary });
}

type Outcome =
  | 'triggered'
  | 'skipped_already_queued'
  | 'failed_paynl'
  | 'failed_other';

async function processOne(
  supabase: ReturnType<typeof createAdminClient>,
  mandate: DueMandate,
): Promise<Outcome> {
  if (!mandate.monthly_amount || mandate.monthly_amount <= 0) {
    console.error('[Cron recurring-debits] mandate missing monthly_amount', {
      mandateId: mandate.id,
    });
    return 'failed_other';
  }

  const today = new Date();
  const processDate = isoDate(addDays(today, MIN_LEAD_DAYS));

  // Phase 1: claim the (mandate, process_date) slot. The unique index
  // means a parallel cron run will get a 23505 here and we skip — this
  // is the lock that keeps double-debits impossible.
  const { data: claimed, error: insertError } = await supabase
    .from('direct_debits')
    .insert({
      mandate_id: mandate.id,
      paynl_service_id: mandate.paynl_service_id,
      amount: mandate.monthly_amount,
      process_date: processDate,
      status: 'PENDING',
    })
    .select('id')
    .single();

  if (insertError) {
    if ((insertError as { code?: string }).code === '23505') {
      // Another worker already queued this slot. No-op.
      return 'skipped_already_queued';
    }
    console.error('[Cron recurring-debits] claim insert failed', {
      mandateId: mandate.id,
      processDate,
      error: insertError.message,
    });
    return 'failed_other';
  }

  const claimedId = claimed.id;

  // Phase 2: actually trigger at Pay.nl.
  let paynlDirectDebitId: string | null = null;
  let paynlOrderId: string | null = null;
  try {
    const debitResponse = await triggerDirectDebit({
      mandate: mandate.paynl_mandate_id,
      isLastOrder: false,
      description: 'Monthly donation',
      processDate,
      amount: { value: mandate.monthly_amount, currency: 'EUR' },
      stats: {
        extra1: mandate.stats_extra1 || '',
        extra2: mandate.stats_extra2 || '',
        extra3: mandate.stats_extra3 || '',
      },
    });
    paynlDirectDebitId = debitResponse.id ?? null;
    paynlOrderId = debitResponse.orderId ?? null;
    if (!paynlDirectDebitId) {
      throw new PayNLError(502, debitResponse, 'Pay.nl returned no directdebit id');
    }
  } catch (err) {
    // Roll back the claim row so this slot becomes free again. We push
    // next_debit_at forward by ONE day so the cron retries tomorrow
    // instead of busy-looping today.
    await supabase.from('direct_debits').delete().eq('id', claimedId);
    const retryAt = addDays(new Date(mandate.next_debit_at), 1).toISOString();
    await supabase
      .from('mandates')
      .update({ next_debit_at: retryAt })
      .eq('id', mandate.id);

    if (err instanceof PayNLError) {
      console.error('[Cron recurring-debits] Pay.nl rejected debit', {
        mandateId: mandate.id,
        paynlMandateId: mandate.paynl_mandate_id,
        status: err.status,
        body: redactPII(err.body),
      });
      return 'failed_paynl';
    }
    console.error('[Cron recurring-debits] unexpected error during trigger', {
      mandateId: mandate.id,
      error: err instanceof Error ? err.message : err,
    });
    return 'failed_other';
  }

  // Phase 3: persist the Pay.nl ids on the claimed row + advance the
  // mandate's next_debit_at one month forward (provisional — the webhook
  // for `directdebit.collected` will rewrite this with the truth from the
  // actual collection date).
  await supabase
    .from('direct_debits')
    .update({
      paynl_directdebit_id: paynlDirectDebitId,
      paynl_order_id: paynlOrderId,
    })
    .eq('id', claimedId);

  const nextRunAt = addMonths(new Date(mandate.next_debit_at), 1).toISOString();
  await supabase
    .from('mandates')
    .update({ next_debit_at: nextRunAt })
    .eq('id', mandate.id);

  console.log('[Cron recurring-debits] debit triggered', {
    mandateId: mandate.id,
    paynlDirectdebitId: paynlDirectDebitId,
    processDate,
  });
  return 'triggered';
}
