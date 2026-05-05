import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  updateLicense,
  isAllianceEnabled,
  PayNLAllianceNotActivatedError,
  PayNLError,
} from '@/lib/paynl-alliance';
import { redactPII } from '@/lib/paynl';
import { assertPayNLProductionConfig } from '@/lib/paynl-production';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

/**
 * PATCH /api/organizations/[id]/merchant/license
 *
 * Updates a person's compliance data on their Pay.nl license.
 * Accepts gender (M|F), birthCountry (ISO-2), birthPlace (city). Sends the
 * Pay.nl-supported fields to PATCH /v2/licenses/{code} and stores everything
 * locally so the dashboard reflects it immediately.
 *
 * Body: { personId, gender?, birthCountry?, birthPlace? } (at least one of
 * the value fields required).
 *
 * Auth: org admin or platform superadmin.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUNTRY_RE = /^[A-Z]{2}$/;
const GENDER_RE = /^[MF]$/;

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

  const limiter = await rateLimit(
    `merchant:license:${id}:${auth.user?.id ?? getClientIp(request.headers)}`,
    {
      limit: 10,
      windowMs: 60_000,
    },
  );
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: 'Too many license updates. Please wait and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limiter.retryAfterSeconds ?? 60) },
      },
    );
  }

  if (!isAllianceEnabled()) {
    return NextResponse.json({ error: 'Pay.nl Alliance is not activated.' }, { status: 503 });
  }
  const productionConfigError = assertPayNLProductionConfig();
  if (productionConfigError) {
    return NextResponse.json({ error: productionConfigError }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  if (typeof b.personId !== 'string' || !UUID_RE.test(b.personId)) {
    return NextResponse.json({ error: 'personId must be a valid UUID' }, { status: 400 });
  }

  let gender: 'M' | 'F' | undefined;
  if (b.gender !== undefined) {
    if (typeof b.gender !== 'string' || !GENDER_RE.test(b.gender)) {
      return NextResponse.json(
        { error: 'gender must be "M" or "F" if provided' },
        { status: 400 },
      );
    }
    gender = b.gender as 'M' | 'F';
  }

  let birthCountry: string | undefined;
  if (b.birthCountry !== undefined) {
    if (typeof b.birthCountry !== 'string' || !COUNTRY_RE.test(b.birthCountry)) {
      return NextResponse.json(
        { error: 'birthCountry must be a 2-letter uppercase ISO country code (e.g. "NL")' },
        { status: 400 },
      );
    }
    birthCountry = b.birthCountry;
  }

  let birthPlace: string | undefined;
  if (b.birthPlace !== undefined) {
    if (typeof b.birthPlace !== 'string' || !b.birthPlace.trim()) {
      return NextResponse.json(
        { error: 'birthPlace must be a non-empty string if provided' },
        { status: 400 },
      );
    }
    birthPlace = b.birthPlace.trim();
  }

  if (!gender && !birthCountry && !birthPlace) {
    return NextResponse.json(
      { error: 'At least one of gender, birthCountry, birthPlace must be provided' },
      { status: 400 },
    );
  }

  const supabaseAdmin = createAdminClient();

  // Resolve the person and verify they belong to this org.
  const { data: person, error: personError } = await supabaseAdmin
    .from('organization_persons')
    .select('id, paynl_license_code, full_name')
    .eq('id', b.personId)
    .eq('organization_id', id)
    .single();

  if (personError || !person) {
    return NextResponse.json({ error: 'Person not found in this organization' }, { status: 404 });
  }
  if (!person.paynl_license_code) {
    return NextResponse.json(
      { error: 'This person has no Pay.nl license code yet — they cannot be updated.' },
      { status: 422 },
    );
  }

  try {
    if (birthCountry || birthPlace) {
      await updateLicense({
        licenseCode: person.paynl_license_code,
        birthCountry,
        birthPlace,
      });
    }

    // Persist locally so the UI reflects the change immediately. Gender lives
    // only locally (Pay.nl V2's PATCH /v2/licenses doesn't accept it; the
    // value is set at create time via POST /v2/merchants persons[].gender).
    const localUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (birthCountry) localUpdate.birth_country = birthCountry;
    if (birthPlace) localUpdate.birth_city = birthPlace;
    if (gender) localUpdate.gender = gender;
    await supabaseAdmin
      .from('organization_persons')
      .update(localUpdate)
      .eq('id', b.personId);

    return NextResponse.json({
      ok: true,
      personId: b.personId,
      gender: gender ?? null,
      birthCountry: birthCountry ?? null,
      birthPlace: birthPlace ?? null,
    });
  } catch (error) {
    if (error instanceof PayNLAllianceNotActivatedError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof PayNLError) {
      console.error('[Alliance] updateLicense failed', {
        organizationId: id,
        personId: b.personId,
        licenseCode: person.paynl_license_code,
        status: error.status,
        body: redactPII(error.body),
      });
      return NextResponse.json(
        { error: `Pay.nl rejected the update (HTTP ${error.status})` },
        { status: 502 },
      );
    }
    console.error('[Alliance] Unexpected error in merchant/license PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
