import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOrder, isSandboxMode, PayNLError, redactPII } from '@/lib/paynl';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/appointments/book
 *
 * Public endpoint. Creates a PENDING appointment + Pay.nl order for a 1-on-1
 * session and returns the hosted-checkout redirect URL.
 *
 * Flow:
 *   1. Rate limit per IP (5/min — bookings are cheaper than donations to spam).
 *   2. Validate offering is active.
 *   3. Verify the requested scheduled_at is not already taken.
 *   4. INSERT appointment (status=pending). The UNIQUE constraint on
 *      (offering_id, scheduled_at, status) rejects double-booking races.
 *   5. Create Pay.nl order with stats_extra2='appointment' so the exchange
 *      webhook knows to flip the appointment to confirmed.
 *   6. INSERT transactions row linked to the appointment.
 *   7. Return checkout_url.
 *
 * NOTE: a richer availability check (against weekly rules + overrides) would
 * repeat all of the slots endpoint logic. We keep it simple here by relying
 * on the double-booking unique constraint + the UI calling /slots first.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface BookBody {
  offering_id: string;
  scheduled_at: string; // ISO UTC
  quantity: number; // integer >= 1; multiplies the offering's base duration & price
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  notes?: string;
  return_url: string;
  locale?: string;
  payment_method_id?: number;
  issuer_id?: string;
}

const MAX_QUANTITY = 8;

function isSafeUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function validate(raw: unknown): { ok: true; body: BookBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.offering_id !== 'string' || !UUID_RE.test(r.offering_id)) {
    return { ok: false, error: 'offering_id must be a uuid' };
  }
  if (typeof r.scheduled_at !== 'string') {
    return { ok: false, error: 'scheduled_at must be an ISO timestamp' };
  }
  const when = new Date(r.scheduled_at);
  if (Number.isNaN(when.getTime())) {
    return { ok: false, error: 'scheduled_at is not a valid timestamp' };
  }
  if (when.getTime() <= Date.now()) {
    return { ok: false, error: 'scheduled_at must be in the future' };
  }
  let quantity = 1;
  if (r.quantity !== undefined) {
    if (
      typeof r.quantity !== 'number' ||
      !Number.isInteger(r.quantity) ||
      r.quantity < 1 ||
      r.quantity > MAX_QUANTITY
    ) {
      return { ok: false, error: `quantity must be an integer between 1 and ${MAX_QUANTITY}` };
    }
    quantity = r.quantity;
  }
  if (typeof r.customer_name !== 'string' || r.customer_name.trim().length < 2) {
    return { ok: false, error: 'customer_name is required' };
  }
  if (typeof r.customer_email !== 'string' || !EMAIL_RE.test(r.customer_email)) {
    return { ok: false, error: 'customer_email must be a valid email' };
  }
  if (r.customer_phone !== undefined && typeof r.customer_phone !== 'string') {
    return { ok: false, error: 'customer_phone must be a string' };
  }
  if (r.notes !== undefined && typeof r.notes !== 'string') {
    return { ok: false, error: 'notes must be a string' };
  }
  if (typeof r.return_url !== 'string' || !isSafeUrl(r.return_url)) {
    return { ok: false, error: 'return_url must be an http(s) URL' };
  }
  if (r.locale !== undefined && typeof r.locale !== 'string') {
    return { ok: false, error: 'locale must be a string' };
  }
  if (
    r.payment_method_id !== undefined &&
    (typeof r.payment_method_id !== 'number' || !Number.isInteger(r.payment_method_id))
  ) {
    return { ok: false, error: 'payment_method_id must be an integer' };
  }
  if (r.issuer_id !== undefined && typeof r.issuer_id !== 'string') {
    return { ok: false, error: 'issuer_id must be a string' };
  }

  return {
    ok: true,
    body: {
      offering_id: r.offering_id,
      scheduled_at: when.toISOString(),
      quantity,
      customer_name: (r.customer_name as string).trim(),
      customer_email: (r.customer_email as string).trim().toLowerCase(),
      customer_phone: r.customer_phone
        ? (r.customer_phone as string).trim() || undefined
        : undefined,
      notes: r.notes ? (r.notes as string).trim() || undefined : undefined,
      return_url: r.return_url,
      locale: (r.locale as string) || 'nl_NL',
      payment_method_id: r.payment_method_id as number | undefined,
      issuer_id: r.issuer_id as string | undefined,
    },
  };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limited = rateLimit(`appointments:book:${ip}`, 5, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((limited.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const v = validate(raw);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const body = v.body;

  const supabaseAdmin = createAdminClient();

  const { data: offering, error: offeringError } = await supabaseAdmin
    .from('appointment_offerings')
    .select(
      'id, organization_id, sheikh_name, slug, price, duration_minutes, timezone, is_active',
    )
    .eq('id', body.offering_id)
    .eq('is_active', true)
    .single();

  if (offeringError || !offering) {
    return NextResponse.json({ error: 'Offering not found or inactive' }, { status: 404 });
  }

  // Load org for Pay.nl routing + stats.
  const { data: organization } = await supabaseAdmin
    .from('organizations')
    .select('id, paynl_service_id, paynl_merchant_id, donations_active')
    .eq('id', offering.organization_id)
    .single();

  if (!organization) {
    return NextResponse.json({ error: 'Organization not configured' }, { status: 503 });
  }

  const serviceId =
    organization.donations_active && organization.paynl_service_id
      ? organization.paynl_service_id
      : process.env.PAYNL_SERVICE_ID;

  if (!serviceId) {
    return NextResponse.json(
      { error: 'Offering is not configured for payments yet' },
      { status: 503 },
    );
  }

  const totalDuration = offering.duration_minutes * body.quantity;
  const totalPrice = offering.price * body.quantity;

  // Insert the pending appointment first — the UNIQUE(offering_id, scheduled_at, status)
  // constraint is our double-booking race guard. If two requests hit at once,
  // one of them will 23505 here and be bounced before we hit Pay.nl.
  const { data: appointment, error: apptError } = await supabaseAdmin
    .from('appointments')
    .insert({
      offering_id: offering.id,
      organization_id: offering.organization_id,
      scheduled_at: body.scheduled_at,
      duration_minutes: totalDuration,
      customer_name: body.customer_name,
      customer_email: body.customer_email,
      customer_phone: body.customer_phone ?? null,
      notes: body.notes ?? null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (apptError || !appointment) {
    // 23505 = unique violation (slot already taken)
    const pgCode = (apptError as { code?: string } | null)?.code;
    if (pgCode === '23505') {
      return NextResponse.json(
        { error: 'That time slot is no longer available. Please pick another.' },
        { status: 409 },
      );
    }
    console.error('[Appointments] book insert failed', apptError);
    return NextResponse.json({ error: 'Could not create appointment' }, { status: 500 });
  }

  try {
    const exchangeSecret = process.env.PAYNL_EXCHANGE_SECRET;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!exchangeSecret || !siteUrl) {
      throw new Error('Missing PAYNL_EXCHANGE_SECRET or NEXT_PUBLIC_SITE_URL');
    }
    const exchangeBase = siteUrl
      .replace(/\/$/, '')
      .replace(/^(https?:\/\/)www\.([^/]*\.vercel\.app)/i, '$1$2');
    const exchangeUrl = `${exchangeBase}/api/webhook/pay?token=${encodeURIComponent(exchangeSecret)}`;

    const nameParts = body.customer_name.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || body.customer_name;
    const lastName = nameParts.slice(1).join(' ') || '';

    let paymentMethod: { id: number; input?: { issuerId: string } } | undefined;
    if (body.payment_method_id) {
      paymentMethod = { id: body.payment_method_id };
      if (body.issuer_id) paymentMethod.input = { issuerId: body.issuer_id };
    }

    const description = `Appointment ${offering.sheikh_name}`;
    const slugSafe = offering.slug.slice(0, 16);

    const order = await createOrder({
      serviceId,
      amount: { value: totalPrice, currency: 'EUR' },
      description,
      reference: `APPT-${slugSafe}`,
      returnUrl: body.return_url,
      exchangeUrl,
      ...(paymentMethod && { paymentMethod }),
      customer: { firstName, lastName, email: body.customer_email, locale: body.locale },
      stats: {
        extra1: appointment.id,
        extra2: 'appointment',
        extra3: offering.organization_id,
        info: description,
      },
    });

    const { data: tx, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        paynl_order_id: order.orderId,
        paynl_service_id: serviceId,
        amount: totalPrice,
        currency: 'EUR',
        status: 'PENDING',
        donor_name: body.customer_name,
        donor_email: body.customer_email,
        stats_extra1: appointment.id,
        stats_extra2: 'appointment',
        stats_extra3: offering.organization_id,
        is_test: isSandboxMode(),
      })
      .select('id')
      .single();

    if (txError) {
      console.error('[Appointments] transaction insert failed', {
        orderId: order.orderId,
        error: txError.message,
      });
    } else if (tx) {
      await supabaseAdmin
        .from('appointments')
        .update({ transaction_id: tx.id })
        .eq('id', appointment.id);
    }

    console.log('[Appointments] Order created', {
      orderId: order.orderId,
      appointmentId: appointment.id,
      organizationId: offering.organization_id,
      sandbox: isSandboxMode(),
    });

    return NextResponse.json({
      checkout_url: order.links.redirect,
      order_id: order.orderId,
      appointment_id: appointment.id,
    });
  } catch (error) {
    // Roll back the pending appointment — payment creation failed, the slot
    // should not be held.
    await supabaseAdmin.from('appointments').delete().eq('id', appointment.id);

    if (error instanceof PayNLError) {
      console.error('[Appointments] PayNL order create failed', {
        status: error.status,
        body: redactPII(error.body),
      });
      return NextResponse.json(
        { error: 'Payment provider rejected the request. Please try again.' },
        { status: 502 },
      );
    }
    console.error('[Appointments] Unexpected error in /book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
