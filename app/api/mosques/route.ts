import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from '@/lib/api-auth';
import {
  createMerchant,
  isAllianceEnabled,
  PayNLAllianceNotActivatedError,
  type CreateMerchantPayload,
} from '@/lib/paynl-alliance';
import { PayNLError, redactPII } from '@/lib/paynl';

/**
 * /api/mosques
 *
 * GET  — list mosques (superadmin only for Phase 2 foundation)
 * POST — create a mosque and optionally register it with Pay.nl Alliance
 *
 * Auth: platform superadmin only. Phase 2.5 will add a public mosque signup
 * flow at /api/mosques/signup with its own lightweight validation path.
 */

// ---------------------------------------------------------------------------
// GET — list mosques
// ---------------------------------------------------------------------------

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('mosques')
    .select(
      'id, slug, name, city, country, kyc_status, is_active, paynl_service_id, paynl_merchant_id, platform_fee_bps, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Mosques] list failed', error);
    return NextResponse.json({ error: 'Failed to list mosques' }, { status: 500 });
  }

  return NextResponse.json({ mosques: data || [] });
}

// ---------------------------------------------------------------------------
// POST — create a mosque
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

interface CreateMosqueBody {
  slug: string;
  name: string;
  description?: string;
  contact_email: string;
  contact_phone?: string;
  city?: string;
  country?: string;
  bank_iban?: string;
  bank_account_holder?: string;
  platform_fee_bps?: number;
  /** Full Alliance KYC payload (only required when register_with_paynl is true). */
  alliance?: CreateMerchantPayload;
  /** If true, call createMerchant immediately and mark mosque active on success. */
  register_with_paynl?: boolean;
}

function validateBody(
  raw: unknown,
): { ok: true; body: CreateMosqueBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.slug !== 'string' || !SLUG_RE.test(r.slug)) {
    return { ok: false, error: 'slug must be lowercase kebab-case' };
  }
  if (typeof r.name !== 'string' || r.name.trim().length === 0) {
    return { ok: false, error: 'name is required' };
  }
  if (typeof r.contact_email !== 'string' || !EMAIL_RE.test(r.contact_email)) {
    return { ok: false, error: 'contact_email is required and must be valid' };
  }
  if (r.bank_iban !== undefined && typeof r.bank_iban === 'string') {
    const ibanClean = r.bank_iban.replace(/\s+/g, '').toUpperCase();
    if (!IBAN_RE.test(ibanClean)) {
      return { ok: false, error: 'bank_iban is not a valid IBAN' };
    }
  }
  if (
    r.platform_fee_bps !== undefined &&
    (typeof r.platform_fee_bps !== 'number' ||
      !Number.isInteger(r.platform_fee_bps) ||
      r.platform_fee_bps < 0 ||
      r.platform_fee_bps > 10000)
  ) {
    return { ok: false, error: 'platform_fee_bps must be an integer between 0 and 10000' };
  }

  return { ok: true, body: r as unknown as CreateMosqueBody };
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

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
    const supabaseAdmin = createAdminClient();

    // Optionally register with Pay.nl Alliance before inserting the row
    // so that paynl_service_id / paynl_merchant_id can land in the insert
    // atomically. When Alliance is not enabled, we just persist the mosque
    // in a 'pending' KYC state.
    let paynlServiceId: string | null = null;
    let paynlMerchantId: string | null = null;
    let paynlSecret: string | null = null;
    let kycStatus: 'pending' | 'submitted' | 'approved' | 'rejected' = 'pending';

    if (body.register_with_paynl) {
      if (!body.alliance) {
        return NextResponse.json(
          { error: 'alliance payload required when register_with_paynl is true' },
          { status: 400 },
        );
      }
      if (!isAllianceEnabled()) {
        return NextResponse.json(
          {
            error:
              'Pay.nl Alliance is not activated yet. Create the mosque without register_with_paynl and wire up Pay.nl later.',
          },
          { status: 409 },
        );
      }
      try {
        const merchant = await createMerchant(body.alliance);
        paynlServiceId = merchant.serviceId;
        paynlMerchantId = merchant.merchantId;
        paynlSecret = merchant.serviceSecret;
        kycStatus = merchant.kycStatus;
      } catch (err) {
        if (err instanceof PayNLAllianceNotActivatedError) {
          return NextResponse.json({ error: err.message }, { status: 409 });
        }
        if (err instanceof PayNLError) {
          console.error('[Mosques] createMerchant failed', {
            status: err.status,
            body: redactPII(err.body),
          });
          return NextResponse.json(
            { error: 'Pay.nl rejected the merchant registration' },
            { status: 502 },
          );
        }
        throw err;
      }
    }

    const { data, error: insertError } = await supabaseAdmin
      .from('mosques')
      .insert({
        slug: body.slug,
        name: body.name.trim(),
        description: body.description || null,
        contact_email: body.contact_email.trim(),
        contact_phone: body.contact_phone || null,
        city: body.city || null,
        country: body.country || 'NL',
        bank_iban: body.bank_iban ? body.bank_iban.replace(/\s+/g, '').toUpperCase() : null,
        bank_account_holder: body.bank_account_holder || null,
        paynl_service_id: paynlServiceId,
        paynl_merchant_id: paynlMerchantId,
        paynl_secret: paynlSecret,
        platform_fee_bps: body.platform_fee_bps ?? 200,
        kyc_status: kycStatus,
        is_active: kycStatus === 'approved',
        onboarded_at: kycStatus === 'approved' ? new Date().toISOString() : null,
      })
      .select(
        'id, slug, name, kyc_status, is_active, paynl_service_id, paynl_merchant_id, platform_fee_bps, created_at',
      )
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'A mosque with this slug already exists' },
          { status: 409 },
        );
      }
      console.error('[Mosques] insert failed', insertError);
      return NextResponse.json({ error: 'Failed to create mosque' }, { status: 500 });
    }

    console.log('[Mosques] Created', { id: data.id, slug: data.slug, kyc: data.kyc_status });
    return NextResponse.json({ mosque: data }, { status: 201 });
  } catch (err) {
    console.error('[Mosques] Unexpected error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
