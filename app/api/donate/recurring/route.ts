import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMandate, isSandboxMode, PayNLError, redactPII } from '@/lib/paynl';
import {
  resolveOrganizationServiceIdForCampaign,
  resolveOrganizationServiceIdForOrganization,
} from '@/lib/paynl-organization-resolver';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email/email-service';
import { formatBillingDate, formatMoney } from '@/lib/email/billing-utils';
import { buildDonorFrom } from '@/lib/email/donation-utils';
import { DonorMandateRegisteredEmail } from '@/lib/email/templates/DonorMandateRegisteredEmail';
import { buildManageUrl, generateManageToken } from '@/lib/donor-manage-token';

/**
 * POST /api/donate/recurring
 *
 * Public endpoint. Creates a Pay.nl FLEXIBLE SEPA mandate so the mosque can
 * trigger monthly debits against it via /api/mandates/:id/debit.
 *
 * Critical PII rule: the full IBAN and BIC are forwarded to Pay.nl in the
 * same request and then immediately forgotten. We only persist `iban_owner`
 * (name on account). Pay.nl is the system of record for bank details.
 *
 * The mandate row is inserted with status=PENDING. It flips to ACTIVE only
 * after the first incassocollected webhook arrives (see webhook handler).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecurringDonationBody {
  // Exactly one of these is required:
  //   campaign_id    → recurring donation to a specific campaign
  //   organization_id → membership mandate (no campaign)
  campaign_id?: string;
  organization_id?: string;
  amount: number; // cents
  currency?: string;
  donor_name: string;
  donor_email: string;
  iban: string;
  bic: string;
  iban_owner: string;
  process_date: string; // ISO date (YYYY-MM-DD)
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Basic IBAN shape: 2-letter country + 2 check digits + 11-30 alphanumerics.
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;
// Basic BIC/SWIFT shape: 8 or 11 alphanumerics.
const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isFutureDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const minimum = new Date();
  minimum.setUTCHours(0, 0, 0, 0);
  minimum.setUTCDate(minimum.getUTCDate() + 2); // today+2 minimum per plan
  return d.getTime() >= minimum.getTime();
}

function validateBody(
  raw: unknown,
): { ok: true; body: RecurringDonationBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const r = raw as Record<string, unknown>;

  const hasCampaign = typeof r.campaign_id === 'string' && UUID_RE.test(r.campaign_id);
  const hasOrg = typeof r.organization_id === 'string' && UUID_RE.test(r.organization_id);
  if (hasCampaign === hasOrg) {
    return {
      ok: false,
      error: 'Provide exactly one of campaign_id or organization_id',
    };
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
  if (typeof r.iban !== 'string') {
    return { ok: false, error: 'iban is required' };
  }
  const ibanClean = r.iban.replace(/\s+/g, '').toUpperCase();
  if (!IBAN_RE.test(ibanClean)) {
    return { ok: false, error: 'iban is not in a valid format' };
  }
  if (typeof r.bic !== 'string') {
    return { ok: false, error: 'bic is required' };
  }
  const bicClean = r.bic.replace(/\s+/g, '').toUpperCase();
  if (!BIC_RE.test(bicClean)) {
    return { ok: false, error: 'bic is not in a valid format' };
  }
  if (typeof r.iban_owner !== 'string' || r.iban_owner.trim().length === 0) {
    return { ok: false, error: 'iban_owner is required' };
  }
  if (typeof r.process_date !== 'string' || !isFutureDate(r.process_date)) {
    return { ok: false, error: 'process_date must be an ISO date at least 2 days in the future' };
  }

  return {
    ok: true,
    body: {
      campaign_id: hasCampaign ? (r.campaign_id as string) : undefined,
      organization_id: hasOrg ? (r.organization_id as string) : undefined,
      amount: r.amount,
      currency: (r.currency as string) || 'EUR',
      donor_name: r.donor_name.trim(),
      donor_email: r.donor_email.trim(),
      iban: ibanClean,
      bic: bicClean,
      iban_owner: r.iban_owner.trim(),
      process_date: r.process_date,
    },
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // ---- 1. Rate limit ----------------------------------------------------
  const ip = getClientIp(request.headers);
  const limited = rateLimit(`donate:recurring:${ip}`, 10, 60_000);
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
    // ---- 3. Resolve campaign (campaign-scoped) or organization (membership) -
    const supabaseAdmin = createAdminClient();

    let campaignId: string | null = null;
    let campaignTitle: string | null = null;
    let campaignCauseType: string | null = null;
    let referenceSlug: string;

    let resolved: Awaited<ReturnType<typeof resolveOrganizationServiceIdForCampaign>>;

    if (body.campaign_id) {
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('campaigns')
        .select('id, title, slug, cause_type, organization_id, is_active')
        .eq('id', body.campaign_id)
        .eq('is_active', true)
        .single();

      if (campaignError || !campaign) {
        return NextResponse.json({ error: 'Campaign not found or inactive' }, { status: 404 });
      }

      resolved = await resolveOrganizationServiceIdForCampaign(supabaseAdmin, campaign.id);
      if (!resolved) {
        return NextResponse.json(
          { error: 'Campaign is not configured for payments yet' },
          { status: 503 },
        );
      }

      campaignId = campaign.id;
      campaignTitle = campaign.title;
      campaignCauseType = campaign.cause_type || null;
      referenceSlug = campaign.slug.slice(0, 16);
    } else {
      // Membership mandate — no campaign attached.
      resolved = await resolveOrganizationServiceIdForOrganization(
        supabaseAdmin,
        body.organization_id as string,
      );
      if (!resolved) {
        return NextResponse.json(
          { error: 'Organization is not configured for payments yet' },
          { status: 503 },
        );
      }
      referenceSlug = 'MEMBER';
    }

    const serviceId = resolved.serviceId;

    // Webhook URL — must be set per-mandate. Without it the mandate is
    // created with exchangeUrl=null at Pay.nl and every event (pending,
    // collected, storno, refund) is dropped. Mirrors /api/donate/one-time.
    const exchangeSecret = process.env.PAYNL_EXCHANGE_SECRET;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!exchangeSecret || !siteUrl) {
      console.error(
        '[PayNL] Missing required env: PAYNL_EXCHANGE_SECRET / NEXT_PUBLIC_SITE_URL',
      );
      return NextResponse.json({ error: 'Server not configured for payments' }, { status: 500 });
    }
    const exchangeBase = siteUrl
      .replace(/\/$/, '')
      .replace(/^(https?:\/\/)www\.([^/]*\.vercel\.app)/i, '$1$2');
    const exchangeUrl = `${exchangeBase}/api/webhook/pay?token=${encodeURIComponent(exchangeSecret)}`;

    const mandatePayload = {
      serviceId,
      reference: `MANDATE-${referenceSlug}-${Date.now()}`,
      description: campaignTitle || 'Monthly membership', // createMandate truncates to 32 chars
      processDate: body.process_date,
      type: 'FLEXIBLE' as const,
      exchangeUrl,
      customer: {
        ipAddress: ip,
        email: body.donor_email,
        bankAccount: {
          iban: body.iban,
          bic: body.bic,
          owner: body.iban_owner,
        },
      },
      amount: { value: body.amount, currency: body.currency || 'EUR' },
      stats: {
        extra1: campaignId || resolved.organizationId,
        extra2: campaignCauseType || (campaignId ? '' : 'membership'),
        extra3: resolved.organizationId,
      },
    };

    // ---- 5. Call Pay.nl -------------------------------------------------
    const mandateResponse = await createMandate(mandatePayload);
    if (!mandateResponse.code) {
      console.error('[PayNL] Mandate response missing code', redactPII(mandateResponse));
      return NextResponse.json({ error: 'Payment provider returned an unexpected response' }, { status: 502 });
    }

    // ---- 6. Persist mandate (NO iban / bic stored) ---------------------
    const manageToken = generateManageToken();
    const { data: mandateRow, error: insertError } = await supabaseAdmin
      .from('mandates')
      .insert({
        campaign_id: campaignId,
        organization_id: resolved.organizationId,
        paynl_mandate_id: mandateResponse.code,
        paynl_service_id: serviceId,
        mandate_type: 'FLEXIBLE',
        donor_name: body.donor_name,
        donor_email: body.donor_email,
        iban_owner: body.iban_owner,
        status: 'PENDING',
        monthly_amount: body.amount,
        stats_extra1: campaignId || resolved.organizationId,
        stats_extra2: campaignCauseType || (campaignId ? null : 'membership'),
        stats_extra3: resolved.organizationId,
        manage_token: manageToken,
      })
      .select('id, paynl_mandate_id, manage_token')
      .single();

    if (insertError || !mandateRow) {
      console.error('[PayNL] Failed to persist mandate row', {
        paynlMandateId: mandateResponse.code,
        error: insertError?.message,
      });
      // Pay.nl already has the mandate. Return a usable response; the
      // reconciliation job can backfill. Prevents double-mandate on retry.
      return NextResponse.json({
        paynl_mandate_id: mandateResponse.code,
        status: 'PENDING',
        message: `Mandate created. First debit scheduled for ${body.process_date}.`,
      });
    }

    console.log('[PayNL] Mandate created', {
      mandateRowId: mandateRow.id,
      paynlMandateId: mandateRow.paynl_mandate_id,
      campaignId: campaignId,
      organizationId: resolved.organizationId,
      kind: campaignId ? 'campaign' : 'membership',
      routing: resolved.usedFallback ? 'env-fallback' : 'per-org',
      sandbox: isSandboxMode(),
    });

    // ---- 7. Donor confirmation email -----------------------------------
    // Sent immediately so the donor isn't waiting 3–5 days for the first
    // collection webhook. SEPA pre-notification rules also require the
    // donor be told the upcoming debit's date and amount before the first
    // collection. Failures here MUST NOT fail the request — the mandate
    // is already registered with Pay.nl.
    try {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', resolved.organizationId)
        .single();

      const orgName = org?.name || 'the mosque';
      const ibanLast4 = body.iban.slice(-4);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bayaan.app';
      const manageUrl = buildManageUrl(siteUrl, manageToken);

      const subjectKind = campaignId ? 'donation' : 'membership';
      const result = await sendEmail({
        to: body.donor_email,
        from: buildDonorFrom(orgName),
        subject: `Your ${formatMoney(body.amount, body.currency || 'EUR')}/month ${subjectKind} to ${orgName} is set up`,
        react: DonorMandateRegisteredEmail({
          donorName: body.donor_name,
          mosqueName: orgName,
          monthlyAmount: formatMoney(body.amount, body.currency || 'EUR'),
          campaignTitle: campaignTitle || 'Monthly membership',
          firstDebitDate: formatBillingDate(body.process_date),
          mandateReference: mandateRow.paynl_mandate_id,
          ibanLast4,
          manageUrl,
        }),
        tags: [
          { name: 'type', value: 'donor_mandate_registered' },
          { name: 'organization_id', value: resolved.organizationId },
          { name: 'kind', value: campaignId ? 'campaign' : 'membership' },
        ],
      });
      if (result && typeof result === 'object' && 'success' in result && result.success === false) {
        console.error('[PayNL] donor mandate-registered email failed', {
          mandateRowId: mandateRow.id,
          error: (result as { error?: unknown }).error,
        });
      }
    } catch (emailErr) {
      console.error('[PayNL] donor mandate-registered email threw', {
        mandateRowId: mandateRow.id,
        error: emailErr instanceof Error ? emailErr.message : emailErr,
      });
    }

    // ---- 8. Return to client -------------------------------------------
    return NextResponse.json({
      mandate_id: mandateRow.id,
      paynl_mandate_id: mandateRow.paynl_mandate_id,
      status: 'PENDING',
      message: `Mandate created. First debit scheduled for ${body.process_date}.`,
    });
  } catch (error) {
    if (error instanceof PayNLError) {
      console.error('[PayNL] Mandate create failed', {
        status: error.status,
        body: redactPII(error.body),
      });
      return NextResponse.json(
        { error: 'Payment provider rejected the mandate. Please verify your bank details.' },
        { status: 502 },
      );
    }
    console.error('[PayNL] Unexpected error in /api/donate/recurring:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
