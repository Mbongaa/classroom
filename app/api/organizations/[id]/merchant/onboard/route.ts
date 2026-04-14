import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  createMerchant,
  isAllianceEnabled,
  PayNLAllianceNotActivatedError,
  PayNLError,
} from '@/lib/paynl-alliance';

/**
 * POST /api/organizations/[id]/merchant/onboard
 *
 * Submit KYC / business details to register this organization as a Pay.nl
 * sub-merchant under the Bayaan Hub Alliance account.
 *
 * Auth: org admin or platform superadmin.
 *
 * Guard: the organization must NOT already have a paynl_merchant_id. To
 * re-onboard (e.g. after rejection), the superadmin must first clear the
 * merchant fields via the donation-settings PATCH endpoint.
 *
 * On success, persists:
 *   - paynl_merchant_id  (M-XXXX-XXXX)
 *   - paynl_service_id   (SL-XXXX-XXXX)
 *   - paynl_secret        (per-org service secret)
 *   - kyc_status          (from Pay.nl response)
 *
 * The org's donations_active flag stays false until kyc_status becomes
 * 'approved' (either via the status-sync endpoint or a future webhook).
 */

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KVK_RE = /^[0-9]{8}$/;

interface OnboardBody {
  legalName: string;
  tradingName: string;
  kvkNumber: string;
  vatNumber?: string;
  contactEmail: string;
  contactPhone?: string;
  iban: string;
  ibanOwner: string;
  address: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    country: string;
  };
  businessDescription: string;
  websiteUrl?: string;
}

function validateBody(
  raw: unknown,
): { ok: true; body: OnboardBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.legalName !== 'string' || r.legalName.trim().length === 0) {
    return { ok: false, error: 'legalName is required' };
  }
  if (typeof r.tradingName !== 'string' || r.tradingName.trim().length === 0) {
    return { ok: false, error: 'tradingName is required' };
  }
  if (typeof r.kvkNumber !== 'string' || !KVK_RE.test(r.kvkNumber)) {
    return { ok: false, error: 'kvkNumber must be an 8-digit KvK number' };
  }
  if (r.vatNumber !== undefined && typeof r.vatNumber !== 'string') {
    return { ok: false, error: 'vatNumber must be a string if provided' };
  }
  if (typeof r.contactEmail !== 'string' || !EMAIL_RE.test(r.contactEmail)) {
    return { ok: false, error: 'contactEmail must be a valid email' };
  }
  if (r.contactPhone !== undefined && typeof r.contactPhone !== 'string') {
    return { ok: false, error: 'contactPhone must be a string if provided' };
  }
  if (typeof r.iban !== 'string') {
    return { ok: false, error: 'iban is required' };
  }
  const ibanClean = r.iban.replace(/\s+/g, '').toUpperCase();
  if (!IBAN_RE.test(ibanClean)) {
    return { ok: false, error: 'iban is not in a valid format' };
  }
  if (typeof r.ibanOwner !== 'string' || r.ibanOwner.trim().length === 0) {
    return { ok: false, error: 'ibanOwner is required' };
  }

  // Address validation
  if (!r.address || typeof r.address !== 'object') {
    return { ok: false, error: 'address is required and must be an object' };
  }
  const addr = r.address as Record<string, unknown>;
  if (typeof addr.street !== 'string' || addr.street.trim().length === 0) {
    return { ok: false, error: 'address.street is required' };
  }
  if (typeof addr.houseNumber !== 'string' || addr.houseNumber.trim().length === 0) {
    return { ok: false, error: 'address.houseNumber is required' };
  }
  if (typeof addr.postalCode !== 'string' || addr.postalCode.trim().length === 0) {
    return { ok: false, error: 'address.postalCode is required' };
  }
  if (typeof addr.city !== 'string' || addr.city.trim().length === 0) {
    return { ok: false, error: 'address.city is required' };
  }
  if (typeof addr.country !== 'string' || addr.country.length !== 2) {
    return { ok: false, error: 'address.country must be a 2-letter ISO code (e.g. "NL")' };
  }

  if (typeof r.businessDescription !== 'string' || r.businessDescription.trim().length === 0) {
    return { ok: false, error: 'businessDescription is required' };
  }
  if (r.websiteUrl !== undefined && typeof r.websiteUrl !== 'string') {
    return { ok: false, error: 'websiteUrl must be a string if provided' };
  }

  return {
    ok: true,
    body: {
      legalName: r.legalName.trim(),
      tradingName: r.tradingName.trim(),
      kvkNumber: r.kvkNumber,
      vatNumber: r.vatNumber ? (r.vatNumber as string).trim() : undefined,
      contactEmail: r.contactEmail.trim(),
      contactPhone: r.contactPhone ? (r.contactPhone as string).trim() : undefined,
      iban: ibanClean,
      ibanOwner: r.ibanOwner.trim(),
      address: {
        street: addr.street.trim(),
        houseNumber: addr.houseNumber.trim(),
        postalCode: addr.postalCode.trim(),
        city: addr.city.trim(),
        country: addr.country.toUpperCase(),
      },
      businessDescription: r.businessDescription.trim(),
      websiteUrl: r.websiteUrl ? (r.websiteUrl as string).trim() : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  // ---- 1. Auth: org admin or superadmin -----------------------------------
  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  // ---- 2. Check Alliance is enabled --------------------------------------
  if (!isAllianceEnabled()) {
    return NextResponse.json(
      {
        error:
          'Pay.nl Alliance is not yet activated on this platform. ' +
          'Contact the platform administrator.',
      },
      { status: 503 },
    );
  }

  // ---- 3. Parse + validate body ------------------------------------------
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
    // ---- 4. Guard: org must not already be onboarded ----------------------
    const supabaseAdmin = createAdminClient();
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, paynl_merchant_id, kyc_status')
      .eq('id', id)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (org.paynl_merchant_id) {
      return NextResponse.json(
        {
          error: `Organization already has a merchant account (${org.paynl_merchant_id}). ` +
            `Current KYC status: ${org.kyc_status}. ` +
            'To re-onboard, a superadmin must first clear the merchant fields.',
        },
        { status: 409 },
      );
    }

    // ---- 5. Call Pay.nl Alliance createMerchant ---------------------------
    const result = await createMerchant(body);

    // ---- 6. Persist merchant details to the org row -----------------------
    const updatePayload: Record<string, unknown> = {
      paynl_merchant_id: result.merchantId,
      paynl_service_id: result.serviceId,
      paynl_secret: result.serviceSecret,
      kyc_status: result.kycStatus,
      // Also sync contact/bank fields so the org row is the source of truth
      contact_email: body.contactEmail,
      bank_iban: body.iban,
      bank_account_holder: body.ibanOwner,
      city: body.address.city,
      country: body.address.country,
    };
    if (body.contactPhone) {
      updatePayload.contact_phone = body.contactPhone;
    }

    // If Pay.nl immediately approved (rare but possible for known entities),
    // flip donations_active and set onboarded_at.
    if (result.kycStatus === 'approved') {
      updatePayload.donations_active = true;
      updatePayload.onboarded_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from('organizations')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      // Pay.nl has created the merchant but we failed to persist locally.
      // Log loudly so it can be reconciled.
      console.error('[Alliance] Failed to persist merchant details', {
        organizationId: id,
        merchantId: result.merchantId,
        serviceId: result.serviceId,
        error: updateError.message,
      });
      return NextResponse.json(
        {
          error: 'Merchant created at Pay.nl but failed to save locally. Contact support.',
          merchantId: result.merchantId,
        },
        { status: 500 },
      );
    }

    console.log('[Alliance] Merchant onboarded', {
      organizationId: id,
      merchantId: result.merchantId,
      serviceId: result.serviceId,
      kycStatus: result.kycStatus,
    });

    return NextResponse.json({
      merchantId: result.merchantId,
      serviceId: result.serviceId,
      kycStatus: result.kycStatus,
      donationsActive: result.kycStatus === 'approved',
    });
  } catch (error) {
    if (error instanceof PayNLAllianceNotActivatedError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof PayNLError) {
      console.error('[Alliance] createMerchant failed', {
        organizationId: id,
        status: error.status,
        body: error.body,
      });
      return NextResponse.json(
        { error: 'Pay.nl rejected the merchant application. Please verify your details.' },
        { status: 502 },
      );
    }
    console.error('[Alliance] Unexpected error in merchant/onboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
