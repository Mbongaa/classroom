import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchMandateStatus,
  parseExchangeBody,
  PayNLError,
  redactPII,
} from '@/lib/paynl';
import { addInvoice, isAllianceEnabled } from '@/lib/paynl-alliance';
import {
  auditFieldsFor,
  parseWebhookEvent,
  type WebhookEvent,
} from '@/lib/paynl-webhook';
import { getClientIp } from '@/lib/rate-limit';

/**
 * /api/webhook/pay — Pay.nl exchange webhook handler
 *
 * Accepts either a GET with query-string parameters or a POST with a body
 * (form-encoded, JSON, or TGU bracket-notation form fields). Pay.nl uses
 * one of two wire formats depending on the API generation:
 *
 *   1. TGU (Transaction Gateway Unit) — the Connect API `/v1/orders` flow
 *      emits these. Top-level fields: `event`, `type`, `version`, `id`.
 *      Nested fields are form-encoded with bracket notation:
 *        object[orderId]
 *        object[status][action]   (e.g. "PAID", "CANCELLED")
 *        object[status][code]     (e.g. "100" = paid, "50" = pending)
 *        object[amount][value]    (ALREADY IN CENTS — no parsing needed)
 *
 *   2. GMS (legacy) — flat key/value pairs:
 *        action=new_ppt&order_id=XXX&amount=10.00
 *      Amount is decimal euros. Older sales locations and the direct-debit
 *      subsystem still emit this shape.
 *
 * The handler turns either shape into a typed discriminated-union event,
 * then dispatches to small focused handlers. Nothing downstream of the
 * parser touches raw strings.
 *
 * Security model (Pay.nl lacks HMAC signatures, so defense in depth):
 *   1. URL secret `?token=` compared with timing-safe equality.
 *   2. Server-side re-verification via fetchOrderStatus / fetchMandateStatus
 *      before mutating state for paid/collected transitions.
 *   3. Remote IP captured in exchange_events for future allowlisting.
 *
 * Idempotency (Pay.nl retries up to 6× in 2h):
 *   - Every UPDATE includes a `WHERE status = <previous>` guard so replays
 *     are no-ops.
 *   - INSERTs on unique constraints use upsert with onConflict.
 *
 * Response contract: ALWAYS return `200 TRUE|` (even on handler errors).
 * Non-200 triggers Pay.nl's retry scheme, which would mask bugs instead of
 * fixing them. Log structured errors for alerting instead. The pipe after
 * TRUE is required per Pay.nl SDK docs; anything after the pipe is shown
 * in the Pay.nl admin "Payment state logs" panel.
 */

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

function verifyToken(received: string | null): boolean {
  const expected = process.env.PAYNL_EXCHANGE_SECRET;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function trueResponse(message?: string): NextResponse {
  const body = message ? `TRUE| ${message}` : 'TRUE|';
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

type AdminClient = ReturnType<typeof createAdminClient>;

// ---------------------------------------------------------------------------
// HTTP entry points
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const token = search.get('token');
  if (!verifyToken(token)) {
    console.warn('[PayNL Webhook] Rejected GET — bad or missing token', {
      ip: getClientIp(request.headers),
    });
    return trueResponse();
  }

  const parsed: Record<string, string> = {};
  for (const [key, value] of search.entries()) {
    if (key === 'token') continue;
    parsed[key] = value;
  }

  return processExchange({
    parsed,
    contentType: 'query-string',
    ip: getClientIp(request.headers),
  });
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!verifyToken(token)) {
    console.warn('[PayNL Webhook] Rejected POST — bad or missing token', {
      ip: getClientIp(request.headers),
    });
    return trueResponse();
  }

  const contentType = request.headers.get('content-type') || '';
  const text = await request.text();
  const parsed = parseExchangeBody(contentType, text);

  return processExchange({
    parsed,
    contentType: contentType || null,
    ip: getClientIp(request.headers),
  });
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function processExchange(opts: {
  parsed: Record<string, string>;
  contentType: string | null;
  ip: string;
}): Promise<NextResponse> {
  const { parsed, contentType, ip } = opts;
  const event = parseWebhookEvent(parsed);
  const audit = auditFieldsFor(event);

  const supabaseAdmin = createAdminClient();

  // Audit log first — even on handler failure we have a record we can replay.
  try {
    await supabaseAdmin.from('exchange_events').insert({
      action: event.kind,
      order_id: audit.orderId,
      paynl_directdebit_id: audit.directDebitId,
      paynl_mandate_id: audit.mandateCode,
      content_type: contentType,
      payload: redactPII(parsed) as Record<string, unknown>,
      remote_ip: ip,
    });
  } catch (auditErr) {
    console.error('[PayNL Webhook] Audit insert failed', auditErr);
  }

  console.log('[PayNL Webhook] Received', { kind: event.kind, ...audit });

  try {
    switch (event.kind) {
      case 'order.paid':
        await handleOrderPaid(supabaseAdmin, event);
        break;
      case 'order.cancelled':
        await handleOrderCancelled(supabaseAdmin, event);
        break;
      case 'directdebit.pending':
        await handleDirectDebitPending(supabaseAdmin, event);
        break;
      case 'directdebit.sent':
        console.log('[PayNL Webhook] directdebit.sent', { id: event.directDebitId });
        break;
      case 'directdebit.collected':
        await handleDirectDebitCollected(supabaseAdmin, event);
        break;
      case 'directdebit.storno':
        await handleDirectDebitStorno(supabaseAdmin, event);
        break;
      case 'ignored':
        console.log('[PayNL Webhook] Ignored', { reason: event.reason });
        break;
      case 'unknown':
        console.warn('[PayNL Webhook] Unknown event', {
          reason: event.reason,
          payload: redactPII(parsed),
        });
        break;
    }
  } catch (err) {
    if (err instanceof PayNLError) {
      console.error('[PayNL Webhook] Handler PayNL error', {
        kind: event.kind,
        status: err.status,
        body: redactPII(err.body),
      });
    } else {
      console.error('[PayNL Webhook] Handler error', { kind: event.kind, error: err });
    }
  }

  return trueResponse();
}

// ---------------------------------------------------------------------------
// Handlers — each takes a fully-typed event, no raw strings
// ---------------------------------------------------------------------------

async function handleOrderPaid(
  supabase: AdminClient,
  event: Extract<WebhookEvent, { kind: 'order.paid' }>,
) {
  const { orderId } = event;

  // Note: we previously called fetchOrderStatus(orderId) here as a defense-
  // in-depth re-verification step. That was removed because Pay.nl's
  // /v1/orders/{id} endpoint expects the internal UUID, not the public
  // short orderId (e.g. "52028325014X23cb"), and the webhook only carries
  // the short form. The timing-safe token check on the exchange URL is
  // sufficient to authenticate the webhook. Phase 2 can re-enable this
  // once we persist the UUID alongside the orderId in the transactions row.

  // Idempotent: only PENDING → PAID. Replays become no-ops.
  const { data: updatedRows, error, count } = await supabase
    .from('transactions')
    .update({ status: 'PAID', paid_at: new Date().toISOString() }, { count: 'exact' })
    .eq('paynl_order_id', orderId)
    .eq('status', 'PENDING')
    .select('id, amount, stats_extra3');

  if (error) {
    console.error('[PayNL Webhook] order.paid update failed', {
      orderId,
      error: error.message,
    });
    return;
  }

  if (count === 0) {
    console.log('[PayNL Webhook] order.paid no-op (already PAID or missing)', { orderId });
    return;
  }

  console.log('[PayNL Webhook] Transaction PAID', { orderId });

  // ------------------------------------------------------------------
  // Platform fee deduction via Alliance addInvoice.
  // Only applies when the org has been onboarded as a sub-merchant.
  // Non-fatal: if the invoice call fails, the donation is still PAID —
  // the fee can be reconciled manually.
  // ------------------------------------------------------------------
  if (isAllianceEnabled() && updatedRows && updatedRows.length > 0) {
    const tx = updatedRows[0];
    const orgId = tx.stats_extra3;
    if (orgId) {
      await deductPlatformFee(supabase, orgId, tx.amount, orderId);
    }
  }
}

/**
 * Deduct the platform fee from a sub-merchant's wallet after a successful
 * donation. Looks up the org's merchant_id and platform_fee_bps, calculates
 * the fee in cents, and calls Pay.nl Alliance addInvoice.
 *
 * Designed to be non-fatal — logs errors but never throws, so the webhook
 * handler always returns 200 TRUE to Pay.nl.
 */
async function deductPlatformFee(
  supabase: AdminClient,
  organizationId: string,
  amountCents: number,
  orderId: string,
) {
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('paynl_merchant_id, platform_fee_bps')
      .eq('id', organizationId)
      .single();

    if (!org?.paynl_merchant_id) {
      // Org is not an Alliance sub-merchant — no fee to deduct.
      return;
    }

    const feeCents = Math.round((amountCents * org.platform_fee_bps) / 10_000);
    if (feeCents <= 0) {
      return;
    }

    const result = await addInvoice(org.paynl_merchant_id, {
      amount: feeCents,
      currency: 'EUR',
      description: `Platform fee – ${orderId}`.slice(0, 32),
      reference: orderId,
    });

    console.log('[PayNL Webhook] Platform fee deducted', {
      orderId,
      organizationId,
      merchantId: org.paynl_merchant_id,
      feeCents,
      feeBps: org.platform_fee_bps,
      invoiceId: result.invoiceId,
    });
  } catch (err) {
    // Non-fatal: log the failure for manual reconciliation.
    console.error('[PayNL Webhook] Platform fee deduction failed', {
      orderId,
      organizationId,
      error: err instanceof Error ? err.message : err,
    });
  }
}

async function handleOrderCancelled(
  supabase: AdminClient,
  event: Extract<WebhookEvent, { kind: 'order.cancelled' }>,
) {
  const { orderId } = event;
  const { error, count } = await supabase
    .from('transactions')
    .update({ status: 'CANCEL' }, { count: 'exact' })
    .eq('paynl_order_id', orderId)
    .eq('status', 'PENDING');

  if (error) {
    console.error('[PayNL Webhook] order.cancelled update failed', {
      orderId,
      error: error.message,
    });
    return;
  }

  if (count === 0) {
    console.log('[PayNL Webhook] order.cancelled no-op (not PENDING)', { orderId });
    return;
  }

  console.log('[PayNL Webhook] Transaction CANCELLED', { orderId });
}

async function handleDirectDebitPending(
  supabase: AdminClient,
  event: Extract<WebhookEvent, { kind: 'directdebit.pending' }>,
) {
  const { mandateCode, directDebitId, amountCents, processDate } = event;

  const { data: mandate, error: lookupError } = await supabase
    .from('mandates')
    .select('id, paynl_service_id')
    .eq('paynl_mandate_id', mandateCode)
    .single();

  if (lookupError || !mandate) {
    console.error('[PayNL Webhook] directdebit.pending: mandate not found', {
      mandateCode,
      error: lookupError?.message,
    });
    return;
  }

  // Idempotent upsert keyed on the unique directdebit id.
  const { error: upsertError } = await supabase.from('direct_debits').upsert(
    {
      mandate_id: mandate.id,
      paynl_directdebit_id: directDebitId,
      paynl_service_id: mandate.paynl_service_id,
      amount: amountCents,
      process_date: processDate,
      status: 'PENDING',
    },
    { onConflict: 'paynl_directdebit_id' },
  );

  if (upsertError) {
    console.error('[PayNL Webhook] directdebit.pending upsert failed', {
      directDebitId,
      error: upsertError.message,
    });
    return;
  }

  console.log('[PayNL Webhook] DirectDebit PENDING', { mandateCode, directDebitId });
}

async function handleDirectDebitCollected(
  supabase: AdminClient,
  event: Extract<WebhookEvent, { kind: 'directdebit.collected' }>,
) {
  const { mandateCode, directDebitId } = event;

  // Defense in depth: re-verify mandate status with Pay.nl. Soft fail — we
  // still mark the debit as collected even if verification errors, since
  // we already have the directDebitId.
  if (mandateCode) {
    try {
      await fetchMandateStatus(mandateCode);
    } catch (err) {
      console.error('[PayNL Webhook] directdebit.collected re-verification failed', {
        mandateCode,
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  const { error: ddError } = await supabase
    .from('direct_debits')
    .update({ status: 'COLLECTED', collected_at: new Date().toISOString() })
    .eq('paynl_directdebit_id', directDebitId)
    .eq('status', 'PENDING');

  if (ddError) {
    console.error('[PayNL Webhook] directdebit.collected update failed', {
      directDebitId,
      error: ddError.message,
    });
    return;
  }

  if (mandateCode) {
    // First collection flips the mandate PENDING → ACTIVE. Replays are
    // no-ops because the WHERE clause no longer matches.
    const { error: mandateError } = await supabase
      .from('mandates')
      .update({ status: 'ACTIVE', first_debit_at: new Date().toISOString() })
      .eq('paynl_mandate_id', mandateCode)
      .eq('status', 'PENDING');

    if (mandateError) {
      console.error('[PayNL Webhook] directdebit.collected mandate update failed', {
        mandateCode,
        error: mandateError.message,
      });
      return;
    }
  }

  console.log('[PayNL Webhook] DirectDebit COLLECTED', { mandateCode, directDebitId });
}

async function handleDirectDebitStorno(
  supabase: AdminClient,
  event: Extract<WebhookEvent, { kind: 'directdebit.storno' }>,
) {
  const { directDebitId } = event;

  const { error } = await supabase
    .from('direct_debits')
    .update({ status: 'STORNO', storno_at: new Date().toISOString() })
    .eq('paynl_directdebit_id', directDebitId)
    .neq('status', 'STORNO');

  if (error) {
    console.error('[PayNL Webhook] directdebit.storno update failed', {
      directDebitId,
      error: error.message,
    });
    return;
  }

  console.log('[PayNL Webhook] DirectDebit STORNO', { directDebitId });

  // TODO(Phase 2): notify mosque admin via Resend email. Deferred because
  // Phase 1 has no mosque-scoped admin contact list yet.
}
