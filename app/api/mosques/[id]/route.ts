import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireMosqueAdmin, requireSuperAdmin } from '@/lib/api-auth';

/**
 * /api/mosques/[id]
 *
 * GET    — read a mosque (mosque admin OR superadmin)
 * PATCH  — update editable fields (mosque admin OR superadmin)
 * DELETE — remove a mosque (superadmin only, because it cascades)
 *
 * Editable fields are scoped — Pay.nl fields (paynl_service_id, etc.) and
 * platform_fee_bps are superadmin-only. Mosque admins can only edit their
 * own profile/contact/bank details.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid mosque id' }, { status: 400 });
  }

  const auth = await requireMosqueAdmin(id, ['admin', 'manager', 'viewer']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('mosques')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Mosque not found' }, { status: 404 });
  }

  // Never return the paynl_secret to the client.
  const { paynl_secret: _secret, ...safe } = data as Record<string, unknown>;
  return NextResponse.json({ mosque: safe });
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

interface UpdateMosqueBody {
  name?: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  city?: string;
  bank_iban?: string;
  bank_account_holder?: string;
  // Superadmin-only below:
  platform_fee_bps?: number;
  is_active?: boolean;
  kyc_status?: 'pending' | 'submitted' | 'approved' | 'rejected';
}

const SUPERADMIN_ONLY_FIELDS = new Set([
  'platform_fee_bps',
  'is_active',
  'kyc_status',
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid mosque id' }, { status: 400 });
  }

  const auth = await requireMosqueAdmin(id, ['admin']);
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

  // Whitelist of editable fields.
  if (typeof body.name === 'string' && body.name.trim().length > 0) update.name = body.name.trim();
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
    update.bank_iban = clean;
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
    .from('mosques')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    console.error('[Mosques] update failed', error);
    return NextResponse.json({ error: 'Failed to update mosque' }, { status: 500 });
  }

  const { paynl_secret: _secret, ...safe } = data as Record<string, unknown>;
  return NextResponse.json({ mosque: safe });
}

// ---------------------------------------------------------------------------
// DELETE — superadmin only (cascades to mosque_members)
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid mosque id' }, { status: 400 });
  }

  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  // Safety: refuse if the mosque still has campaigns (campaigns.mosque_id
  // has ON DELETE RESTRICT, but catch early so we return a clean error).
  const { count } = await supabaseAdmin
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('mosque_id', id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: mosque has ${count} campaign(s). Deactivate or reassign them first.` },
      { status: 409 },
    );
  }

  const { error } = await supabaseAdmin.from('mosques').delete().eq('id', id);
  if (error) {
    console.error('[Mosques] delete failed', error);
    return NextResponse.json({ error: 'Failed to delete mosque' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
