import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchDirectDebitStatus,
  fetchMandateStatus,
  listDirectDebitsByMandate,
  PayNLError,
} from '@/lib/paynl';

/**
 * GET/POST /api/cron/reconcile-paynl
 *
 * Daily reconciliation pass between Pay.nl and our DB. Catches drift caused
 * by lost/dropped webhooks: if Pay.nl says a mandate has had its first
 * collection or a direct-debit has been collected and our row is still
 * PENDING, we sync. Without this, a single dropped webhook leaves a
 * stuck-PENDING mandate that the recurring-debits cron skips forever.
 *
 * Scope (intentionally narrow — write-after-write conflicts with the
 * primary webhook handler are avoided by only flipping FROM PENDING):
 *   - PENDING mandates older than 24h → check Pay.nl, flip to ACTIVE
 *     when lastDirectDebitDate is set, or CANCELLED when deletedAt is set.
 *   - PENDING direct_debits older than 24h → check Pay.nl, flip to
 *     COLLECTED or REVERSED based on Pay.nl status.
 *
 * What this does NOT do:
 *   - Detect transactions/mandates that exist at Pay.nl but not in our DB
 *     (true backfill). That's a bigger job.
 *   - Replay donor/admin notification emails for synced rows. Reconciled
 *     state is silent; admins see it next time they open the dashboard.
 *
 * Auth: same Bearer CRON_SECRET pattern as the rest of the cron routes.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const STALE_THRESHOLD_HOURS = 24;
const MAX_PER_RUN = 100;

interface PendingMandate {
  id: string;
  paynl_mandate_id: string;
}

interface PendingDirectDebit {
  id: string;
  paynl_directdebit_id: string | null;
  paynl_order_id: string | null;
  mandate_id: string;
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
    console.error('[Cron reconcile-paynl] CRON_SECRET not configured; refusing to run.');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString();

  const mandateSummary = await reconcileMandates(supabase, cutoff);
  const backfillSummary = await backfillMissingDirectDebits(supabase);
  const debitSummary = await reconcileDirectDebits(supabase, cutoff);

  console.log('[Cron reconcile-paynl] run complete', {
    mandates: mandateSummary,
    backfill: backfillSummary,
    directDebits: debitSummary,
  });

  return NextResponse.json({
    ok: true,
    mandates: mandateSummary,
    backfill: backfillSummary,
    directDebits: debitSummary,
  });
}

/**
 * Insert missing `direct_debits` rows for ACTIVE mandates whose first (or
 * subsequent) debit fired without our webhook recording it. Runs after
 * reconcileMandates so new ACTIVE flips in this run are also covered.
 *
 * Strategy:
 *   1. Pull all ACTIVE mandates (cap to MAX_PER_RUN; lowest paynl_id-by-time).
 *   2. For each, list debits at Pay.nl via /v2/directdebits?mandate[eq]=...
 *   3. Upsert any debit Pay.nl reports that we don't have locally. Status
 *      is mapped from Pay.nl's phase to our enum (PENDING / COLLECTED / STORNO).
 *
 * Idempotent — `paynl_directdebit_id` is unique, so a re-run inserts nothing.
 */
async function backfillMissingDirectDebits(
  supabase: ReturnType<typeof createAdminClient>,
) {
  const summary = { mandates_checked: 0, debits_inserted: 0, errors: 0 };

  const { data: mandates, error } = await supabase
    .from('mandates')
    .select('id, paynl_mandate_id, paynl_service_id')
    .eq('status', 'ACTIVE')
    .limit(MAX_PER_RUN)
    .returns<{ id: string; paynl_mandate_id: string; paynl_service_id: string }[]>();

  if (error) {
    console.error('[Reconcile/backfill] mandates fetch failed', error.message);
    return { ...summary, errors: 1 };
  }

  for (const m of mandates ?? []) {
    summary.mandates_checked += 1;
    try {
      const live = await listDirectDebitsByMandate(m.paynl_mandate_id);
      if (live.length === 0) continue;

      // Skip ids we already have. Single round-trip per mandate.
      const ids = live.map((l) => l.id).filter(Boolean);
      const { data: existing } = await supabase
        .from('direct_debits')
        .select('paynl_directdebit_id')
        .in('paynl_directdebit_id', ids);
      const known = new Set((existing ?? []).map((r) => r.paynl_directdebit_id));

      for (const dd of live) {
        if (!dd.id || known.has(dd.id)) continue;

        const status = mapPayNLPhaseToLocal(dd.status, dd.declined, dd.collectedAt, dd.reversedAt);
        const insertRow: Record<string, unknown> = {
          mandate_id: m.id,
          paynl_directdebit_id: dd.id,
          paynl_order_id: dd.paynlOrderId,
          paynl_service_id: m.paynl_service_id,
          amount: dd.amount?.value ?? 0,
          currency: dd.amount?.currency ?? 'EUR',
          process_date: dd.processDate ? dd.processDate.slice(0, 10) : null,
          status,
          collected_at: dd.collectedAt ?? null,
          storno_at: dd.reversedAt ?? null,
        };
        if (dd.createdAt) insertRow.created_at = dd.createdAt;

        const { error: insertError } = await supabase
          .from('direct_debits')
          .insert(insertRow);

        if (insertError) {
          // Race with the webhook handler (or another reconcile run) inserting
          // first — unique constraint kicks in. Ignore.
          if ((insertError as { code?: string }).code === '23505') continue;
          summary.errors += 1;
          console.error('[Reconcile/backfill] direct_debit insert failed', {
            paynlDirectDebitId: dd.id,
            error: insertError.message,
          });
          continue;
        }
        summary.debits_inserted += 1;
        console.log('[Reconcile/backfill] inserted missing direct_debit', {
          mandateId: m.id,
          paynlDirectDebitId: dd.id,
          status,
        });
      }
    } catch (err) {
      summary.errors += 1;
      if (err instanceof PayNLError) {
        console.error('[Reconcile/backfill] Pay.nl rejected list', {
          mandateId: m.id,
          paynlMandateId: m.paynl_mandate_id,
          status: err.status,
        });
      } else {
        console.error('[Reconcile/backfill] threw', {
          mandateId: m.id,
          error: err instanceof Error ? err.message : err,
        });
      }
    }
  }

  return summary;
}

function mapPayNLPhaseToLocal(
  phase: string | null,
  declined: boolean,
  collectedAt?: string | null,
  reversedAt?: string | null,
): 'PENDING' | 'COLLECTED' | 'STORNO' {
  if (reversedAt || declined) return 'STORNO';
  if (collectedAt) return 'COLLECTED';
  const p = (phase ?? '').toLowerCase();
  if (p === 'collected' || p === 'paid') return 'COLLECTED';
  if (p === 'reversed' || p === 'storno' || p === 'returned') return 'STORNO';
  return 'PENDING';
}

async function reconcileMandates(
  supabase: ReturnType<typeof createAdminClient>,
  cutoff: string,
) {
  const summary = { checked: 0, activated: 0, cancelled: 0, still_pending: 0, errors: 0 };

  // Reconcile two failure modes:
  //   1. PENDING locally + already collected at Pay.nl (lost first-collection webhook)
  //   2. ACTIVE locally + deleted at Pay.nl (cancel-route DB-write failure)
  // Same row shape, two queries OR'd together via UNION-style two fetches.
  const { data: pendingRows, error: pendingError } = await supabase
    .from('mandates')
    .select('id, paynl_mandate_id')
    .eq('status', 'PENDING')
    .lt('created_at', cutoff)
    .limit(MAX_PER_RUN)
    .returns<PendingMandate[]>();

  const { data: activeRows, error: activeError } = await supabase
    .from('mandates')
    .select('id, paynl_mandate_id')
    .eq('status', 'ACTIVE')
    .lt('updated_at', cutoff)
    .limit(MAX_PER_RUN)
    .returns<PendingMandate[]>();

  if (pendingError || activeError) {
    console.error('[Reconcile] mandates fetch failed', {
      pendingError: pendingError?.message,
      activeError: activeError?.message,
    });
    return { ...summary, errors: 1 };
  }

  const rows = [...(pendingRows ?? []), ...(activeRows ?? [])];

  for (const m of rows) {
    summary.checked += 1;
    try {
      const live = await fetchMandateStatus(m.paynl_mandate_id);

      if (live.deletedAt) {
        // Catches both PENDING and ACTIVE drift: a cancelled mandate at
        // Pay.nl that we still have as either pre-flip or active.
        const { count } = await supabase
          .from('mandates')
          .update({ status: 'CANCELLED' }, { count: 'exact' })
          .eq('id', m.id)
          .in('status', ['PENDING', 'ACTIVE']);
        if ((count ?? 0) > 0) {
          summary.cancelled += 1;
          console.log('[Reconcile] mandate flipped to CANCELLED', {
            mandateId: m.id,
            paynlMandateId: m.paynl_mandate_id,
          });
        }
        continue;
      }

      if (live.lastDirectDebitDate) {
        const firstDebitIso = new Date(live.lastDirectDebitDate).toISOString();
        const next = new Date(live.lastDirectDebitDate);
        next.setUTCMonth(next.getUTCMonth() + 1);
        await supabase
          .from('mandates')
          .update({
            status: 'ACTIVE',
            first_debit_at: firstDebitIso,
            next_debit_at: next.toISOString(),
          })
          .eq('id', m.id)
          .eq('status', 'PENDING');
        summary.activated += 1;
        console.log('[Reconcile] mandate flipped to ACTIVE (webhook had been missed)', {
          mandateId: m.id,
          paynlMandateId: m.paynl_mandate_id,
          firstDebit: firstDebitIso,
        });
        continue;
      }

      summary.still_pending += 1;
    } catch (err) {
      summary.errors += 1;
      if (err instanceof PayNLError) {
        console.error('[Reconcile] Pay.nl rejected mandate fetch', {
          mandateId: m.id,
          paynlMandateId: m.paynl_mandate_id,
          status: err.status,
        });
      } else {
        console.error('[Reconcile] mandate fetch threw', {
          mandateId: m.id,
          error: err instanceof Error ? err.message : err,
        });
      }
    }
  }

  return summary;
}

async function reconcileDirectDebits(
  supabase: ReturnType<typeof createAdminClient>,
  cutoff: string,
) {
  const summary = {
    checked: 0,
    collected: 0,
    reversed: 0,
    still_pending: 0,
    skipped_no_paynl_id: 0,
    errors: 0,
  };

  const { data: rows, error } = await supabase
    .from('direct_debits')
    .select('id, paynl_directdebit_id, paynl_order_id, mandate_id')
    .eq('status', 'PENDING')
    .lt('created_at', cutoff)
    .limit(MAX_PER_RUN)
    .returns<PendingDirectDebit[]>();

  if (error) {
    console.error('[Reconcile] direct_debits fetch failed', error.message);
    return { ...summary, errors: 1 };
  }

  for (const dd of rows ?? []) {
    summary.checked += 1;

    // Cron's "phase 1 claim" inserts a row before the Pay.nl call. If
    // that call fails the row is rolled back, but if the runtime crashed
    // mid-way it could be stuck PENDING with no paynl_directdebit_id.
    if (!dd.paynl_directdebit_id) {
      summary.skipped_no_paynl_id += 1;
      console.warn('[Reconcile] direct_debit has no paynl_directdebit_id', { id: dd.id });
      continue;
    }

    try {
      const live = await fetchDirectDebitStatus(dd.paynl_directdebit_id);
      const status = (live.status || '').toUpperCase();

      if (status === 'COLLECTED' || live.collectedAt) {
        await supabase
          .from('direct_debits')
          .update({
            status: 'COLLECTED',
            collected_at: live.collectedAt ?? new Date().toISOString(),
          })
          .eq('id', dd.id)
          .eq('status', 'PENDING');
        summary.collected += 1;
        console.log('[Reconcile] direct_debit flipped to COLLECTED', {
          id: dd.id,
          paynlDirectdebitId: dd.paynl_directdebit_id,
        });
        continue;
      }

      if (status === 'REVERSED' || status === 'STORNO' || live.reversedAt) {
        await supabase
          .from('direct_debits')
          .update({
            status: 'STORNO',
            storno_at: live.reversedAt ?? new Date().toISOString(),
          })
          .eq('id', dd.id)
          .eq('status', 'PENDING');
        summary.reversed += 1;
        console.log('[Reconcile] direct_debit flipped to STORNO', {
          id: dd.id,
          paynlDirectdebitId: dd.paynl_directdebit_id,
        });
        continue;
      }

      summary.still_pending += 1;
    } catch (err) {
      summary.errors += 1;
      if (err instanceof PayNLError) {
        console.error('[Reconcile] Pay.nl rejected direct_debit fetch', {
          id: dd.id,
          paynlDirectdebitId: dd.paynl_directdebit_id,
          status: err.status,
        });
      } else {
        console.error('[Reconcile] direct_debit fetch threw', {
          id: dd.id,
          error: err instanceof Error ? err.message : err,
        });
      }
    }
  }

  return summary;
}
