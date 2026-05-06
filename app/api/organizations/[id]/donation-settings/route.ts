import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { THANK_YOU_ANIMATIONS } from '@/lib/thankyou-animations';

/**
 * /api/organizations/[id]/donation-settings
 *
 * GET   — read the org's Pay.nl donation settings (org admin OR superadmin)
 * PATCH — update editable donation fields (org admin OR superadmin)
 *
 * The route is scoped to donation-related fields only. Editing the
 * organization's name, slug, billing/Stripe state etc. lives elsewhere
 * (those are not donation concerns).
 *
 * Editable fields are partitioned by role:
 *   - Org admins can change: contact info, bank account holder, branding (animation)
 *   - Superadmins can additionally change: platform_fee_bps, donations_active,
 *     kyc_status, paynl_service_id, paynl_merchant_id, manual payout approval
 *
 * paynl_secret and full bank_iban are never returned to the client.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

const SUPERADMIN_ONLY_FIELDS = new Set([
  'platform_fee_bps',
  'donations_active',
  'kyc_status',
  'paynl_service_id',
  'paynl_merchant_id',
  'paynl_manual_payout_approved',
]);

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  // Any org member can read; admin/teacher gate is for writes only.
  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select(
      'id, slug, name, description, contact_email, contact_phone, city, country, bank_iban_last4, bank_account_holder, paynl_service_id, paynl_merchant_id, platform_fee_bps, kyc_status, donations_active, paynl_manual_payout_approved, onboarded_at, thankyou_animation_id, created_at, updated_at',
    )
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  return NextResponse.json({ organization: data });
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;
  const isSuperadmin =
    (auth.profile as { role?: string } | undefined)?.role === 'superadmin';

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }

  const body = raw as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  // Whitelist of org-admin editable fields.
  if (typeof body.description === 'string') update.description = body.description;
  if (typeof body.contact_email === 'string') update.contact_email = body.contact_email.trim();
  if (typeof body.contact_phone === 'string') update.contact_phone = body.contact_phone;
  if (typeof body.city === 'string') update.city = body.city;
  if (typeof body.bank_account_holder === 'string')
    update.bank_account_holder = body.bank_account_holder;

  if (typeof body.bank_iban === 'string') {
    const clean = body.bank_iban.replace(/\s+/g, '').toUpperCase();
    if (!IBAN_RE.test(clean)) {
      return NextResponse.json({ error: 'Invalid IBAN' }, { status: 400 });
    }
    update.bank_iban = null;
    update.bank_iban_last4 = clean.slice(-4);
  }

  // Thank-you animation: validated against the catalog so a malicious or
  // typo'd id can't be persisted. NULL is allowed (means "use default").
  if (body.thankyou_animation_id !== undefined) {
    if (body.thankyou_animation_id === null) {
      update.thankyou_animation_id = null;
    } else if (
      typeof body.thankyou_animation_id === 'string' &&
      body.thankyou_animation_id in THANK_YOU_ANIMATIONS
    ) {
      update.thankyou_animation_id = body.thankyou_animation_id;
    } else {
      return NextResponse.json(
        { error: 'Unknown thankyou_animation_id (not in catalog)' },
        { status: 400 },
      );
    }
  }

  // Superadmin-only fields
  for (const field of SUPERADMIN_ONLY_FIELDS) {
    if (body[field] !== undefined) {
      if (!isSuperadmin) {
        return NextResponse.json(
          { error: `Field '${field}' can only be changed by platform superadmins` },
          { status: 403 },
        );
      }
      update[field] = body[field];
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No editable fields in request' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .update(update)
    .eq('id', id)
    .select(
      'id, slug, name, description, contact_email, contact_phone, city, country, bank_iban_last4, bank_account_holder, paynl_service_id, paynl_merchant_id, platform_fee_bps, kyc_status, donations_active, paynl_manual_payout_approved, onboarded_at, thankyou_animation_id, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    console.error('[Organizations donation-settings] update failed', error);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }

  return NextResponse.json({ organization: data });
}
