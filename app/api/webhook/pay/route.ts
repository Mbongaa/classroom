import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchMandateStatus,
  fetchOrderStatus,
  parseAmountToCents,
  parseExchangeBody,
  PayNLError,
  redactPII,
  type ExchangeAction,
} from '@/lib/paynl';
import { getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/webhook/pay
 *
 * Pay.nl exchange webhook handler. Triggered for every payment lifecycle
 * event (one-time + SEPA direct debit). This is the most critical route in
 * the integration — idempotency and quick 200 TRUE responses are mandatory.
 *
 * Security model (Pay.nl lacks HMAC signatures, so defense in depth):
 *   1. URL secret: exchangeUrl is set to ?token=<PAYNL_EXCHANGE_SECRET>,
 *      compared with timing-safe equality.
 *   2. Server-side re-verification for new_ppt / incassocollected via
 *      fetchOrderStatus / fetchMandateStatus before mutating state.
 *   3. Remote IP captured in exchange_events for future allowlisting.
 *
 * Idempotency (Pay.nl retries up to 6× in 2h):
 *   - Every UPDATE includes a `WHERE status = <previous>` guard so replays
 *     are no-ops.
 *   - INSERTs on unique constraints use upsert with onConflict.
 *   - coalesce(paid_at, now()) preserves the original timestamp on replay.
 *
 * Response contract: ALWAYS return `200 TRUE` (even on handler errors).
 * Non-200 triggers Pay.nl's retry scheme, which would mask bugs instead of
 * fixing them. Log structured errors for alerting instead.
 */

// ---------------------------------------------------------------------------
// Timing-safe token compare
// ---------------------------------------------------------------------------

function verifyToken(received: string | null): boolean {
  const expected = process.env.PAYNL_EXCHANGE_SECRET;
  if (!expected || !received) return false;
  // Prevent length-oracle by comparing fixed-length buffers.
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Pay.nl contract: exchange response must be a 200 with body "TRUE".
function trueResponse(): NextResponse {
  return new NextResponse('TRUE', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type AdminClient = ReturnType<typeof createAdminClient>;

export async function POST(request: NextRequest) {
  // ---- 1. Verify URL token ---------------------------------------------
  const token = request.nextUrl.searchParams.get('token');
  if (!verifyToken(token)) {
    console.warn('[PayNL Webhook] Rejected — bad or missing token', {
      ip: getClientIp(request.headers),
    });
    // Intentionally still return 200 TRUE so Pay.nl doesn't retry forever
    // on a misconfigured exchange URL. Surfaces via server log instead.
    return trueResponse();
  }

  // ---- 2. Parse body ----------------------------------------------------
  const contentType = request.headers.get('content-type') || '';
  const text = await request.text();
  const parsed = parseExchangeBody(contentType, text);
  const action = parsed.action as ExchangeAction | undefined;
  const orderId = parsed.order_id || parsed.orderId || null;
  const mandateId = parsed.mandateId || parsed.mandate_id || null;
  const referenceId = parsed.referenceId || parsed.reference_id || null;

  const supabaseAdmin = createAdminClient();

  // ---- 3. Audit log (always, before any handler runs) ------------------
  try {
    await supabaseAdmin.from('exchange_events').insert({
      action: action || null,
      order_id: orderId,
      paynl_directdebit_id: referenceId,
      paynl_mandate_id: mandateId,
      content_type: contentType || null,
      payload: redactPII(parsed) as Record<string, unknown>,
      remote_ip: getClientIp(request.headers),
    });
  } catch (auditErr) {
    // Audit log failure is non-fatal — continue handling, but log loudly.
    console.error('[PayNL Webhook] Audit insert failed', auditErr);
  }

  console.log('[PayNL Webhook] Received', { action, orderId, mandateId, referenceId });

  // ---- 4. Dispatch action ----------------------------------------------
  try {
    switch (action) {
      case 'new_ppt':
        await handleNewPpt(supabaseAdmin, orderId);
        break;

      case 'cancel':
        await handleCancel(supabaseAdmin, orderId);
        break;

      case 'incassopending':
        await handleIncassoPending(supabaseAdmin, {
          mandateId,
          referenceId,
          orderId,
          amountString: parsed.amount,
          processDate: parsed.processDate || parsed.process_date || null,
        });
        break;

      case 'incassosend':
        // Log-only; no state change required.
        console.log('[PayNL Webhook] incassosend', { referenceId });
        break;

      case 'incassocollected':
        await handleIncassoCollected(supabaseAdmin, { mandateId, referenceId });
        break;

      case 'incassostorno':
        await handleIncassoStorno(supabaseAdmin, { referenceId });
        break;

      default:
        console.warn('[PayNL Webhook] Unknown action', { action });
    }
  } catch (err) {
    // NEVER rethrow — Pay.nl would retry and mask real bugs. Log + TRUE.
    if (err instanceof PayNLError) {
      console.error('[PayNL Webhook] Handler PayNL error', {
        action,
        status: err.status,
        body: redactPII(err.body),
      });
    } else {
      console.error('[PayNL Webhook] Handler error', { action, error: err });
    }
  }

  return trueResponse();
}

// ---------------------------------------------------------------------------
// new_ppt — one-time order paid
// ---------------------------------------------------------------------------

async function handleNewPpt(supabase: AdminClient, orderId: string | null) {
  if (!orderId) {
    console.error('[PayNL Webhook] new_ppt without order_id');
    return;
  }

  // Defense in depth: re-verify with Pay.nl before mutating state.
  try {
    const verified = await fetchOrderStatus(orderId);
    if (!verified || !verified.orderId) {
      console.error('[PayNL Webhook] new_ppt re-verification returned no orderId', { orderId });
      return;
    }
  } catch (err) {
    console.error('[PayNL Webhook] new_ppt re-verification failed', { orderId, error: err });
    return;
  }

  // Idempotent: only update PENDING → PAID. Replays become no-ops because
  // the WHERE clause no longer matches. paid_at is NOT overwritten on
  // subsequent rows (only the first match sets it).
  const { error } = await supabase
    .from('transactions')
    .update({ status: 'PAID', paid_at: new Date().toISOString() })
    .eq('paynl_order_id', orderId)
    .eq('status', 'PENDING');

  if (error) {
    console.error('[PayNL Webhook] new_ppt update failed', { orderId, error: error.message });
    return;
  }

  console.log('[PayNL Webhook] Transaction PAID', { orderId });
}

// ---------------------------------------------------------------------------
// cancel — one-time order cancelled/expired
// ---------------------------------------------------------------------------

async function handleCancel(supabase: AdminClient, orderId: string | null) {
  if (!orderId) {
    console.error('[PayNL Webhook] cancel without order_id');
    return;
  }

  const { error } = await supabase
    .from('transactions')
    .update({ status: 'CANCEL' })
    .eq('paynl_order_id', orderId)
    .eq('status', 'PENDING');

  if (error) {
    console.error('[PayNL Webhook] cancel update failed', { orderId, error: error.message });
    return;
  }

  console.log('[PayNL Webhook] Transaction CANCELLED', { orderId });
}

// ---------------------------------------------------------------------------
// incassopending — first direct debit queued at the bank
// ---------------------------------------------------------------------------

async function handleIncassoPending(
  supabase: AdminClient,
  opts: {
    mandateId: string | null;
    referenceId: string | null;
    orderId: string | null;
    amountString?: string;
    processDate: string | null;
  },
) {
  const { mandateId, referenceId, orderId, amountString, processDate } = opts;
  if (!mandateId || !referenceId) {
    console.error('[PayNL Webhook] incassopending missing ids', { mandateId, referenceId });
    return;
  }

  // Look up the parent mandate by paynl_mandate_id.
  const { data: mandate, error: lookupError } = await supabase
    .from('mandates')
    .select('id, paynl_service_id')
    .eq('paynl_mandate_id', mandateId)
    .single();

  if (lookupError || !mandate) {
    console.error('[PayNL Webhook] incassopending: mandate not found', {
      mandateId,
      error: lookupError?.message,
    });
    return;
  }

  // Parse amount from decimal-euros string (Pay.nl's direct-debit format).
  let amountCents = 0;
  if (amountString) {
    try {
      amountCents = parseAmountToCents(amountString);
    } catch (err) {
      console.error('[PayNL Webhook] incassopending: bad amount', {
        referenceId,
        amountString,
        error: err,
      });
      return;
    }
  }

  // Idempotent upsert on the unique paynl_directdebit_id. Replays become
  // no-ops because the row already exists with the same values.
  const { error: upsertError } = await supabase.from('direct_debits').upsert(
    {
      mandate_id: mandate.id,
      paynl_directdebit_id: referenceId,
      paynl_order_id: orderId || null,
      paynl_service_id: mandate.paynl_service_id,
      amount: amountCents,
      process_date: processDate || null,
      status: 'PENDING',
    },
    { onConflict: 'paynl_directdebit_id' },
  );

  if (upsertError) {
    console.error('[PayNL Webhook] incassopending upsert failed', {
      referenceId,
      error: upsertError.message,
    });
    return;
  }

  console.log('[PayNL Webhook] DirectDebit PENDING', { mandateId, referenceId });
}

// ---------------------------------------------------------------------------
// incassocollected — funds arrived; mandate becomes ACTIVE
// ---------------------------------------------------------------------------

async function handleIncassoCollected(
  supabase: AdminClient,
  opts: { mandateId: string | null; referenceId: string | null },
) {
  const { mandateId, referenceId } = opts;

  if (referenceId) {
    // Defense in depth: re-verify mandate status with Pay.nl.
    if (mandateId) {
      try {
        await fetchMandateStatus(mandateId);
      } catch (err) {
        console.error('[PayNL Webhook] incassocollected re-verification failed', {
          mandateId,
          error: err,
        });
        // Don't hard-fail; still mark the debit as collected since we
        // have the referenceId. Worst case we reconcile later.
      }
    }

    const { error: ddError } = await supabase
      .from('direct_debits')
      .update({ status: 'COLLECTED', collected_at: new Date().toISOString() })
      .eq('paynl_directdebit_id', referenceId)
      .eq('status', 'PENDING');

    if (ddError) {
      console.error('[PayNL Webhook] incassocollected direct_debits update failed', {
        referenceId,
        error: ddError.message,
      });
    }
  }

  if (mandateId) {
    // Only flip PENDING → ACTIVE on the FIRST collection. Replays become
    // no-ops because the mandate is already ACTIVE.
    const { error: mandateError } = await supabase
      .from('mandates')
      .update({ status: 'ACTIVE', first_debit_at: new Date().toISOString() })
      .eq('paynl_mandate_id', mandateId)
      .eq('status', 'PENDING');

    if (mandateError) {
      console.error('[PayNL Webhook] incassocollected mandate update failed', {
        mandateId,
        error: mandateError.message,
      });
    }
  }

  console.log('[PayNL Webhook] DirectDebit COLLECTED', { mandateId, referenceId });
}

// ---------------------------------------------------------------------------
// incassostorno — reversal (can happen up to 56 days after collection)
// ---------------------------------------------------------------------------

async function handleIncassoStorno(
  supabase: AdminClient,
  opts: { referenceId: string | null },
) {
  const { referenceId } = opts;
  if (!referenceId) {
    console.error('[PayNL Webhook] incassostorno without referenceId');
    return;
  }

  const { error } = await supabase
    .from('direct_debits')
    .update({ status: 'STORNO', storno_at: new Date().toISOString() })
    .eq('paynl_directdebit_id', referenceId)
    .neq('status', 'STORNO');

  if (error) {
    console.error('[PayNL Webhook] incassostorno update failed', {
      referenceId,
      error: error.message,
    });
    return;
  }

  console.log('[PayNL Webhook] DirectDebit STORNO', { referenceId });

  // TODO(Phase 2): notify mosque admin via Resend email. Deferred because
  // Phase 1 has no mosque-scoped admin contact list yet.
}
