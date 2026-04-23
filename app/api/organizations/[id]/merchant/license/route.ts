import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  updateLicense,
  isAllianceEnabled,
  PayNLAllianceNotActivatedError,
  PayNLError,
} from '@/lib/paynl-alliance';

/**
 * PATCH /api/organizations/[id]/merchant/license
 *
 * Updates a person's compliance data fields on their Pay.nl license.
 * Supports: birthCountry (2-letter ISO code) + birthPlace (city name).
 * Pay.nl requires BOTH fields to save the birth data.
 *
 * Body: { personId: string, birthCountry: string, birthPlace: string }
 *
 * Auth: org admin or platform superadmin.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUNTRY_RE = /^[A-Z]{2}$/;

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

  if (!isAllianceEnabled()) {
    return NextResponse.json({ error: 'Pay.nl Alliance is not activated.' }, { status: 503 });
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
  if (typeof b.birthCountry !== 'string' || !COUNTRY_RE.test(b.birthCountry)) {
    return NextResponse.json(
      { error: 'birthCountry must be a 2-letter uppercase ISO country code (e.g. "NL")' },
      { status: 400 },
    );
  }
  if (typeof b.birthPlace !== 'string' || !b.birthPlace.trim()) {
    return NextResponse.json(
      { error: 'birthPlace (city of birth) is required' },
      { status: 400 },
    );
  }
  const birthPlace = b.birthPlace.trim();

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
    await updateLicense({
      licenseCode: person.paynl_license_code,
      birthCountry: b.birthCountry,
      birthPlace,
    });

    // Persist locally so the UI reflects the change immediately.
    await supabaseAdmin
      .from('organization_persons')
      .update({ birth_country: b.birthCountry, birth_city: birthPlace, updated_at: new Date().toISOString() })
      .eq('id', b.personId);

    return NextResponse.json({ ok: true, personId: b.personId, birthCountry: b.birthCountry, birthPlace });
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
        body: error.body,
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
