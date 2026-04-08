import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOrder, isSandboxMode, PayNLError, redactPII } from '@/lib/paynl';
import { resolveOrganizationServiceIdForCampaign } from '@/lib/paynl-organization-resolver';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/donate/one-time
 *
 * Public endpoint (no auth). Creates a Pay.nl order for a one-time donation
 * to an active campaign and returns the hosted-checkout redirect URL.
 *
 * Mirrors the auth-less Stripe checkout pattern but is intentionally open to
 * anonymous donors. Defenses:
 *   - Rate limited to 10 req/min/IP (see lib/rate-limit.ts)
 *   - Strict input validation before calling Pay.nl
 *   - Donor PII never appears in logs (see redactPII)
 *   - Transaction row is inserted via admin client (bypasses RLS)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OneTimeDonationBody {
  campaign_id: string;
  amount: number; // cents
  currency?: string;
  donor_name: string;
  donor_email: string;
  return_url: string;
  locale?: string;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isSafeUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateBody(raw: unknown): { ok: true; body: OneTimeDonationBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.campaign_id !== 'string' || !UUID_RE.test(r.campaign_id)) {
    return { ok: false, error: 'campaign_id must be a uuid' };
  }
  if (typeof r.amount !== 'number' || !Number.isInteger(r.amount) || r.amount <= 0) {
    return { ok: false, error: 'amount must be a positive integer (cents)' };
  }
  if (r.currency !== undefined && (typeof r.currency !== 'string' || r.currency.length !== 3)) {
    return { ok: false, error: 'currency must be a 3-letter ISO code' };
  }
  if (typeof r.donor_name !== 'string' || r.donor_name.trim().length === 0) {
    return { ok: false, error: 'donor_name is required' };
  }
  if (typeof r.donor_email !== 'string' || !EMAIL_RE.test(r.donor_email)) {
    return { ok: false, error: 'donor_email is required and must be a valid email' };
  }
  if (typeof r.return_url !== 'string' || !isSafeUrl(r.return_url)) {
    return { ok: false, error: 'return_url must be an http(s) URL' };
  }
  if (r.locale !== undefined && typeof r.locale !== 'string') {
    return { ok: false, error: 'locale must be a string if provided' };
  }

  return {
    ok: true,
    body: {
      campaign_id: r.campaign_id,
      amount: r.amount,
      currency: (r.currency as string) || 'EUR',
      donor_name: r.donor_name.trim(),
      donor_email: r.donor_email.trim(),
      return_url: r.return_url,
      locale: (r.locale as string) || 'nl_NL',
    },
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // ---- 1. Rate limit ----------------------------------------------------
  const ip = getClientIp(request.headers);
  const limited = rateLimit(`donate:one-time:${ip}`, 10, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limited.resetAt - Date.now()) / 1000)) } },
    );
  }

  // ---- 2. Parse + validate body -----------------------------------------
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateBody(raw);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const body = validation.body;

  try {
    // ---- 3. Fetch active campaign + its organization's Pay.nl details --
    const supabaseAdmin = createAdminClient();
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('id, title, slug, cause_type, organization_id, is_active')
      .eq('id', body.campaign_id)
      .eq('is_active', true)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found or inactive' }, { status: 404 });
    }

    // Phase 2: resolve the correct paynl_service_id based on the campaign's
    // organization. Falls back to PAYNL_SERVICE_ID env var for organizations
    // that have not yet been onboarded via Alliance createMerchant.
    const resolved = await resolveOrganizationServiceIdForCampaign(supabaseAdmin, campaign.id);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Campaign is not configured for payments yet' },
        { status: 503 },
      );
    }
    const serviceId = resolved.serviceId;

    // ---- 4. Build Pay.nl order payload ---------------------------------
    const exchangeSecret = process.env.PAYNL_EXCHANGE_SECRET;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!exchangeSecret || !siteUrl) {
      console.error(
        '[PayNL] Missing required env: PAYNL_EXCHANGE_SECRET / NEXT_PUBLIC_SITE_URL',
      );
      return NextResponse.json({ error: 'Server not configured for payments' }, { status: 500 });
    }

    // Defensive: if NEXT_PUBLIC_SITE_URL accidentally contains "www." on a
    // *.vercel.app host, the wildcard cert (*.vercel.app) does not cover
    // the nested subdomain and Pay.nl's webhook sender fails the TLS
    // handshake with "no alternative subject name target host name".
    // Strip the www. prefix for vercel.app hosts to avoid this footgun.
    const exchangeBase = siteUrl
      .replace(/\/$/, '')
      .replace(/^(https?:\/\/)www\.([^/]*\.vercel\.app)/i, '$1$2');
    const exchangeUrl = `${exchangeBase}/api/webhook/pay?token=${encodeURIComponent(exchangeSecret)}`;

    // Split donor name conservatively — Pay.nl wants firstName + lastName.
    const nameParts = body.donor_name.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || body.donor_name;
    const lastName = nameParts.slice(1).join(' ') || '';

    const slugSafe = campaign.slug.slice(0, 16);

    const orderPayload = {
      serviceId,
      amount: { value: body.amount, currency: body.currency || 'EUR' },
      description: campaign.title, // createOrder truncates to 32 chars
      reference: `CAMPAIGN-${slugSafe}`,
      returnUrl: body.return_url,
      exchangeUrl,
      customer: {
        firstName,
        lastName,
        email: body.donor_email,
        locale: body.locale,
      },
      stats: {
        extra1: campaign.id,
        extra2: campaign.cause_type || '',
        extra3: campaign.organization_id,
        info: campaign.title,
      },
    };

    // ---- 5. Call Pay.nl -------------------------------------------------
    const order = await createOrder(orderPayload);

    // ---- 6. Persist pending transaction --------------------------------
    const { error: insertError } = await supabaseAdmin.from('transactions').insert({
      campaign_id: campaign.id,
      paynl_order_id: order.orderId,
      paynl_service_id: serviceId,
      amount: body.amount,
      currency: body.currency || 'EUR',
      status: 'PENDING',
      donor_name: body.donor_name,
      donor_email: body.donor_email,
      stats_extra1: campaign.id,
      stats_extra2: campaign.cause_type || null,
      stats_extra3: campaign.organization_id,
      is_test: isSandboxMode(),
    });

    if (insertError) {
      // Pay.nl already has the order — we failed to record it. Log and
      // return success so the donor can still complete checkout; a future
      // reconciliation job will backfill from Pay.nl. This is safer than
      // double-charging if the donor retries.
      console.error('[PayNL] Failed to persist transaction row', {
        orderId: order.orderId,
        campaignId: campaign.id,
        error: insertError.message,
      });
    } else {
      console.log('[PayNL] One-time order created', {
        orderId: order.orderId,
        campaignId: campaign.id,
        organizationId: resolved.organizationId,
        routing: resolved.usedFallback ? 'env-fallback' : 'per-org',
        sandbox: isSandboxMode(),
      });
    }

    // ---- 7. Return checkout URL ----------------------------------------
    return NextResponse.json({
      checkout_url: order.links.redirect,
      order_id: order.orderId,
    });
  } catch (error) {
    if (error instanceof PayNLError) {
      console.error('[PayNL] Order create failed', {
        status: error.status,
        body: redactPII(error.body),
      });
      return NextResponse.json(
        { error: 'Payment provider rejected the request. Please try again.' },
        { status: 502 },
      );
    }
    console.error('[PayNL] Unexpected error in /api/donate/one-time:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
