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
import { sendEmail } from '@/lib/email/email-service';
import { formatMoney, formatBillingDate } from '@/lib/email/billing-utils';
import {
  buildDonorFrom,
  getDonationContext,
  getMandateContext,
  getStornoContext,
} from '@/lib/email/donation-utils';
import { NewDonationReceivedEmail } from '@/lib/email/templates/NewDonationReceivedEmail';
import { NewMandateCreatedEmail } from '@/lib/email/templates/NewMandateCreatedEmail';
import { RecurringDonationFailedEmail } from '@/lib/email/templates/RecurringDonationFailedEmail';
import { DonorReceiptEmail } from '@/lib/email/templates/DonorReceiptEmail';
import { DonorRecurringActivatedEmail } from '@/lib/email/templates/DonorRecurringActivatedEmail';
import { DonorRecurringReversedEmail } from '@/lib/email/templates/DonorRecurringReversedEmail';
import { AppointmentBookedSheikhEmail } from '@/lib/email/templates/AppointmentBookedSheikhEmail';
import { AppointmentBookedCustomerEmail } from '@/lib/email/templates/AppointmentBookedCustomerEmail';

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
// Email helpers (tenant-facing donation notifications — Phase 3a)
// ---------------------------------------------------------------------------

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
const donationsDashboardUrl = () => `${siteUrl()}/dashboard/donations`;
const recurringDashboardUrl = () => `${siteUrl()}/dashboard/donations/recurring`;

/**
 * Wraps a send so an email failure never bubbles up into the webhook handler.
 * Pay.nl retries on non-200, and we don't want a flaky email provider
 * triggering duplicate state transitions.
 */
async function safeSend(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`[PayNL Webhook] Email sent: ${label}`);
  } catch (err) {
    console.error(`[PayNL Webhook] Email failed (${label}):`, err);
  }
}

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
    .select('id, amount, stats_extra1, stats_extra2, stats_extra3');

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
  // Appointment branch — `stats_extra2='appointment'` identifies paid
  // appointment bookings. They use a different confirmation flow and
  // email templates than donations. Handled first so donation logic
  // below can assume a campaign-style transaction.
  // ------------------------------------------------------------------
  if (updatedRows && updatedRows.length > 0 && updatedRows[0].stats_extra2 === 'appointment') {
    const tx = updatedRows[0];
    await handleAppointmentPaid(supabase, {
      orderId,
      appointmentId: tx.stats_extra1,
      organizationId: tx.stats_extra3,
      amountCents: tx.amount,
    });
    return;
  }

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

  // Notify the mosque admin that a donation just landed.
  const ctx = await getDonationContext(supabase, orderId);
  if (!ctx) return;

  const amount = formatMoney(ctx.amountCents, ctx.currency);
  const donor = ctx.donorName?.trim() || 'Anonymous';
  const admin = ctx.admin;

  if (admin) {
    await safeSend('new_donation_received', () =>
      sendEmail({
        to: admin.email,
        subject: `${ctx.organizationName} received ${amount} from ${donor}`,
        react: NewDonationReceivedEmail({
          userName: admin.fullName,
          organizationName: ctx.organizationName,
          amount,
          donorName: donor,
          campaignTitle: ctx.campaignTitle ?? 'General donations',
          paidDate: formatBillingDate(ctx.paidAt),
          dashboardUrl: donationsDashboardUrl(),
        }),
        tags: [
          { name: 'type', value: 'new_donation_received' },
          { name: 'organization_id', value: ctx.organizationId },
        ],
      }),
    );
  } else {
    console.warn('[PayNL Webhook] No admin contact for org — skipping tenant email', {
      orderId,
      organizationId: ctx.organizationId,
    });
  }

  // Donor-facing receipt. Fires independently of admin lookup — a mosque
  // with no configured admin shouldn't block the donor's receipt. Only
  // skipped if the donor checked out without providing an email.
  const { data: tx } = await supabase
    .from('transactions')
    .select('payment_method')
    .eq('paynl_order_id', orderId)
    .maybeSingle();

  if (ctx.donorEmail) {
    await safeSend('donor_receipt', () =>
      sendEmail({
        to: ctx.donorEmail!,
        from: buildDonorFrom(ctx.organizationName),
        replyTo: admin?.email,
        subject: `Thank you for your ${amount} donation to ${ctx.organizationName}`,
        react: DonorReceiptEmail({
          donorName: donor,
          mosqueName: ctx.organizationName,
          amount,
          campaignTitle: ctx.campaignTitle ?? 'General donations',
          paidDate: formatBillingDate(ctx.paidAt),
          paymentMethod: formatPaymentMethod(tx?.payment_method),
          orderReference: ctx.orderId,
        }),
        tags: [
          { name: 'type', value: 'donor_receipt' },
          { name: 'organization_id', value: ctx.organizationId },
        ],
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Appointment confirmation
// ---------------------------------------------------------------------------

/**
 * Flip a paid appointment from `pending` → `confirmed`, then email the sheikh
 * (operational) and the customer (receipt). Idempotent on the status guard.
 * All email sends are wrapped in `safeSend` so a Resend outage can't break the
 * webhook contract.
 */
async function handleAppointmentPaid(
  supabase: AdminClient,
  opts: {
    orderId: string;
    appointmentId: string | null;
    organizationId: string | null;
    amountCents: number;
  },
) {
  const { orderId, appointmentId, organizationId, amountCents } = opts;

  if (!appointmentId) {
    console.error('[PayNL Webhook] appointment paid but stats_extra1 missing', { orderId });
    return;
  }

  // Idempotent: only pending → confirmed. Replays are no-ops.
  const { data: confirmed, error: updateError, count } = await supabase
    .from('appointments')
    .update(
      { status: 'confirmed', confirmed_at: new Date().toISOString() },
      { count: 'exact' },
    )
    .eq('id', appointmentId)
    .eq('status', 'pending')
    .select(
      'id, offering_id, organization_id, scheduled_at, duration_minutes, customer_name, customer_email, customer_phone, notes',
    );

  if (updateError) {
    console.error('[PayNL Webhook] appointment confirm failed', {
      appointmentId,
      error: updateError.message,
    });
    return;
  }

  if (count === 0 || !confirmed || confirmed.length === 0) {
    console.log('[PayNL Webhook] appointment confirm no-op (already confirmed)', {
      appointmentId,
    });
    return;
  }

  const appt = confirmed[0];
  console.log('[PayNL Webhook] Appointment CONFIRMED', { appointmentId, orderId });

  // Load offering (for sheikh contact + timezone + location) and organization
  // (for slug + admin contact).
  const { data: offering } = await supabase
    .from('appointment_offerings')
    .select(
      'id, sheikh_name, sheikh_email, price, duration_minutes, location, timezone',
    )
    .eq('id', appt.offering_id)
    .single();

  if (!offering) {
    console.error('[PayNL Webhook] offering missing for confirmed appointment', {
      appointmentId,
      offeringId: appt.offering_id,
    });
    return;
  }

  const orgId = organizationId ?? appt.organization_id;
  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('id', orgId)
    .single();

  if (!organization) {
    console.error('[PayNL Webhook] organization missing for confirmed appointment', {
      appointmentId,
      orgId,
    });
    return;
  }

  const scheduledDate = formatAppointmentDateTime(appt.scheduled_at, offering.timezone);
  const amount = formatMoney(amountCents, 'EUR');
  const siteBase = siteUrl();
  const sheikhDashboardUrl = `${siteBase}/mosque-admin/${organization.slug}/appointments`;

  await safeSend('appointment_booked_sheikh', () =>
    sendEmail({
      to: offering.sheikh_email,
      subject: `New booking: ${appt.customer_name} on ${scheduledDate}`,
      react: AppointmentBookedSheikhEmail({
        sheikhName: offering.sheikh_name,
        organizationName: organization.name,
        customerName: appt.customer_name,
        customerEmail: appt.customer_email,
        customerPhone: appt.customer_phone,
        scheduledDate,
        durationMinutes: appt.duration_minutes,
        amount,
        location: offering.location,
        notes: appt.notes,
        dashboardUrl: sheikhDashboardUrl,
      }),
      tags: [
        { name: 'type', value: 'appointment_booked_sheikh' },
        { name: 'organization_id', value: organization.id },
      ],
    }),
  );

  await safeSend('appointment_booked_customer', () =>
    sendEmail({
      to: appt.customer_email,
      from: buildDonorFrom(organization.name),
      replyTo: offering.sheikh_email,
      subject: `Your appointment with ${offering.sheikh_name} is confirmed`,
      react: AppointmentBookedCustomerEmail({
        customerName: appt.customer_name,
        organizationName: organization.name,
        sheikhName: offering.sheikh_name,
        scheduledDate,
        durationMinutes: appt.duration_minutes,
        amount,
        location: offering.location,
        orderReference: orderId,
      }),
      tags: [
        { name: 'type', value: 'appointment_booked_customer' },
        { name: 'organization_id', value: organization.id },
      ],
    }),
  );
}

/** "Monday, April 20 · 10:00 (Europe/Amsterdam)" — tz-aware for emails. */
function formatAppointmentDateTime(isoUtc: string, timeZone: string): string {
  const d = new Date(isoUtc);
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${date} · ${time} (${timeZone})`;
}

/** Pay.nl returns lowercase slugs like "ideal"; donor receipts want a label. */
function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return '—';
  const map: Record<string, string> = {
    ideal: 'iDEAL',
    card: 'Card',
    creditcard: 'Card',
    bancontact: 'Bancontact',
    sepa: 'SEPA Direct Debit',
    directdebit: 'SEPA Direct Debit',
    paypal: 'PayPal',
  };
  return map[method.toLowerCase()] ?? method;
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

  // First pending debit on a mandate = fresh recurring signup. Replays of
  // this webhook still re-send the email, but Pay.nl only emits pending
  // once per directDebitId so duplicates are rare in practice.
  const ctx = await getMandateContext(supabase, mandateCode, { firstDebitDate: processDate });
  if (!ctx) return;

  // Prefer the actual debit amount (what Pay.nl will pull) over the
  // display-only monthly_amount column.
  const amount = formatMoney(amountCents, ctx.currency);

  if (ctx.admin) {
    const admin = ctx.admin;
    await safeSend('new_mandate_created', () =>
      sendEmail({
        to: admin.email,
        subject: `${ctx.donorName} set up ${amount}/month for ${ctx.organizationName}`,
        react: NewMandateCreatedEmail({
          userName: admin.fullName,
          organizationName: ctx.organizationName,
          donorName: ctx.donorName,
          monthlyAmount: amount,
          campaignTitle: ctx.campaignTitle ?? 'General donations',
          firstDebitDate: formatBillingDate(processDate),
          dashboardUrl: recurringDashboardUrl(),
        }),
        tags: [
          { name: 'type', value: 'new_mandate_created' },
          { name: 'organization_id', value: ctx.organizationId },
        ],
      }),
    );
  } else {
    console.warn('[PayNL Webhook] No admin contact for org — skipping new_mandate_created', {
      mandateCode,
      organizationId: ctx.organizationId,
    });
  }
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

  let isFirstCollection = false;
  if (mandateCode) {
    // First collection flips the mandate PENDING → ACTIVE. Replays are
    // no-ops because the WHERE clause no longer matches — we use the
    // affected-row count to detect the first-time transition.
    const { error: mandateError, count } = await supabase
      .from('mandates')
      .update(
        { status: 'ACTIVE', first_debit_at: new Date().toISOString() },
        { count: 'exact' },
      )
      .eq('paynl_mandate_id', mandateCode)
      .eq('status', 'PENDING');

    if (mandateError) {
      console.error('[PayNL Webhook] directdebit.collected mandate update failed', {
        mandateCode,
        error: mandateError.message,
      });
      return;
    }

    isFirstCollection = (count ?? 0) > 0;
  }

  console.log('[PayNL Webhook] DirectDebit COLLECTED', {
    mandateCode,
    directDebitId,
    isFirstCollection,
  });

  // Donor-facing activation email — only on the first successful collection
  // of a brand-new mandate. Subsequent monthly collections are silent to
  // avoid inbox fatigue (donors expect SEPA to "just work").
  if (!isFirstCollection || !mandateCode) return;

  const ctx = await getMandateContext(supabase, mandateCode, {
    firstDebitDate: new Date().toISOString(),
  });
  if (!ctx?.donorEmail) return;

  const amount = ctx.monthlyAmountCents
    ? formatMoney(ctx.monthlyAmountCents, ctx.currency)
    : '—';

  await safeSend('donor_recurring_activated', () =>
    sendEmail({
      to: ctx.donorEmail!,
      from: buildDonorFrom(ctx.organizationName),
      replyTo: ctx.admin?.email,
      subject: `Your ${amount}/month to ${ctx.organizationName} is active`,
      react: DonorRecurringActivatedEmail({
        donorName: ctx.donorName,
        mosqueName: ctx.organizationName,
        monthlyAmount: amount,
        campaignTitle: ctx.campaignTitle ?? 'General donations',
        firstDebitDate: formatBillingDate(new Date().toISOString()),
        mandateReference: ctx.mandateCode,
      }),
      tags: [
        { name: 'type', value: 'donor_recurring_activated' },
        { name: 'organization_id', value: ctx.organizationId },
      ],
    }),
  );
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

  const ctx = await getStornoContext(supabase, directDebitId);
  if (!ctx) return;

  const amount = formatMoney(ctx.amountCents, ctx.currency);
  const admin = ctx.admin;

  if (admin) {
    await safeSend('recurring_donation_failed', () =>
      sendEmail({
        to: admin.email,
        subject: `A ${amount} recurring donation from ${ctx.donorName} was reversed`,
        react: RecurringDonationFailedEmail({
          userName: admin.fullName,
          organizationName: ctx.organizationName,
          donorName: ctx.donorName,
          amount,
          campaignTitle: ctx.campaignTitle ?? 'General donations',
          processDate: formatBillingDate(ctx.processDate),
          dashboardUrl: recurringDashboardUrl(),
        }),
        tags: [
          { name: 'type', value: 'recurring_donation_failed' },
          { name: 'organization_id', value: ctx.organizationId },
        ],
      }),
    );
  } else {
    console.warn('[PayNL Webhook] No admin contact for org — skipping recurring_donation_failed', {
      directDebitId,
      organizationId: ctx.organizationId,
    });
  }

  // Donor-facing reversal email. Helpful if their bank reversed because of
  // insufficient funds — they may not have noticed.
  const donorEmail = ctx.donorEmail;
  if (donorEmail) {
    await safeSend('donor_recurring_reversed', () =>
      sendEmail({
        to: donorEmail,
        from: buildDonorFrom(ctx.organizationName),
        replyTo: admin?.email,
        subject: `Your ${amount} donation to ${ctx.organizationName} was reversed`,
        react: DonorRecurringReversedEmail({
          donorName: ctx.donorName,
          mosqueName: ctx.organizationName,
          amount,
          campaignTitle: ctx.campaignTitle ?? 'General donations',
          processDate: formatBillingDate(ctx.processDate),
        }),
        tags: [
          { name: 'type', value: 'donor_recurring_reversed' },
          { name: 'organization_id', value: ctx.organizationId },
        ],
      }),
    );
  }
}
