import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  createLicense,
  deleteLicense,
  isAllianceEnabled,
  PayNLAllianceNotActivatedError,
  PayNLError,
  type LegalForm,
  type MerchantPerson,
} from '@/lib/paynl-alliance';
import { redactPII } from '@/lib/paynl';
import { assertPayNLProductionConfig } from '@/lib/paynl-production';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/organizations/[id]/merchant/persons
 *
 * Adds a person/license to an existing Pay.nl merchant. Two modes:
 *
 * 1. Plain add (no replaceLicenseCode): POST /v2/licenses with full person
 *    data, insert a new local row.
 *
 * 2. Placeholder swap (replaceLicenseCode given): DELETE the empty license
 *    Pay.nl auto-created from the KvK extract, then POST a new one with the
 *    admin-supplied person data, then insert the local row.
 *
 *    The DELETE-then-POST sequence is required because Pay.nl V2's
 *    PATCH /v2/licenses/{code} cannot update firstName/lastName/gender/email/
 *    phone/visitAddress on an existing license — it accepts only
 *    complianceData/name/language/notificationGroup/platform/roles. Replacing
 *    is the only way to push full person data onto an empty placeholder.
 *
 * Body:
 *   {
 *     firstName, lastName, gender ("M"|"F"),
 *     dateOfBirth (YYYY-MM-DD), nationality (ISO-2),
 *     placeOfBirth, birthCountry (ISO-2),
 *     email?, phone?,
 *     address: { street, houseNumber, postalCode, city, country (ISO-2) },
 *     isSignee, isUbo, uboPercentage?,
 *     replaceLicenseCode?    // AL-XXXX-XXXX
 *   }
 *
 * Auth: org admin or platform superadmin.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENDER_RE = /^[MF]$/;
const LICENSE_CODE_RE = /^AL-\d{4}-\d{4}$/;

const PSEUDO_UBO_FORMS: readonly LegalForm[] = ['stichting', 'vereniging', 'cooperatie'];

interface ValidatedPersonBody {
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  dateOfBirth: string;
  nationality: string;
  placeOfBirth: string;
  birthCountry: string;
  email?: string;
  phone?: string;
  address: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    country: string;
  };
  isSignee: boolean;
  isUbo: boolean;
  uboPercentage?: number;
  replaceLicenseCode?: string;
}

function validateBody(
  raw: unknown,
): { ok: true; body: ValidatedPersonBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const b = raw as Record<string, unknown>;

  const requireStr = (key: string): string | { error: string } => {
    const v = b[key];
    if (typeof v !== 'string' || v.trim().length === 0) {
      return { error: `${key} is required` };
    }
    return v.trim();
  };

  const firstName = requireStr('firstName');
  if (typeof firstName !== 'string') return { ok: false, ...firstName };
  const lastName = requireStr('lastName');
  if (typeof lastName !== 'string') return { ok: false, ...lastName };

  if (typeof b.gender !== 'string' || !GENDER_RE.test(b.gender)) {
    return { ok: false, error: 'gender must be "M" or "F"' };
  }

  if (typeof b.dateOfBirth !== 'string' || !DATE_RE.test(b.dateOfBirth)) {
    return { ok: false, error: 'dateOfBirth must be YYYY-MM-DD' };
  }
  const dob = new Date(b.dateOfBirth + 'T00:00:00Z');
  if (Number.isNaN(dob.getTime())) {
    return { ok: false, error: 'dateOfBirth is not a real date' };
  }
  const ageYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 18 || ageYears > 120) {
    return { ok: false, error: 'dateOfBirth implies an implausible age' };
  }

  if (typeof b.nationality !== 'string' || !COUNTRY_RE.test(b.nationality.toUpperCase())) {
    return { ok: false, error: 'nationality must be a 2-letter ISO code' };
  }
  const placeOfBirth = requireStr('placeOfBirth');
  if (typeof placeOfBirth !== 'string') return { ok: false, ...placeOfBirth };
  if (typeof b.birthCountry !== 'string' || !COUNTRY_RE.test(b.birthCountry.toUpperCase())) {
    return { ok: false, error: 'birthCountry must be a 2-letter ISO code' };
  }

  let email: string | undefined;
  if (b.email !== undefined && b.email !== null && b.email !== '') {
    if (typeof b.email !== 'string' || !EMAIL_RE.test(b.email)) {
      return { ok: false, error: 'email must be valid if provided' };
    }
    email = b.email.trim();
  }
  let phone: string | undefined;
  if (b.phone !== undefined && b.phone !== null && b.phone !== '') {
    if (typeof b.phone !== 'string') {
      return { ok: false, error: 'phone must be a string if provided' };
    }
    phone = b.phone.trim();
  }

  if (!b.address || typeof b.address !== 'object') {
    return { ok: false, error: 'address is required' };
  }
  const addr = b.address as Record<string, unknown>;
  for (const key of ['street', 'houseNumber', 'postalCode', 'city'] as const) {
    if (typeof addr[key] !== 'string' || (addr[key] as string).trim().length === 0) {
      return { ok: false, error: `address.${key} is required` };
    }
  }
  if (typeof addr.country !== 'string' || !COUNTRY_RE.test(addr.country.toUpperCase())) {
    return { ok: false, error: 'address.country must be a 2-letter ISO code' };
  }

  if (typeof b.isSignee !== 'boolean') {
    return { ok: false, error: 'isSignee must be a boolean' };
  }
  if (typeof b.isUbo !== 'boolean') {
    return { ok: false, error: 'isUbo must be a boolean' };
  }
  if (!b.isSignee && !b.isUbo) {
    return { ok: false, error: 'Person must be a signee, a UBO, or both' };
  }

  let uboPercentage: number | undefined;
  if (b.isUbo) {
    if (
      typeof b.uboPercentage !== 'number' ||
      b.uboPercentage <= 0 ||
      b.uboPercentage > 100
    ) {
      return {
        ok: false,
        error: 'uboPercentage must be >0 and ≤100 when isUbo=true',
      };
    }
    uboPercentage = b.uboPercentage;
  }

  let replaceLicenseCode: string | undefined;
  if (b.replaceLicenseCode !== undefined && b.replaceLicenseCode !== null && b.replaceLicenseCode !== '') {
    if (typeof b.replaceLicenseCode !== 'string' || !LICENSE_CODE_RE.test(b.replaceLicenseCode)) {
      return { ok: false, error: 'replaceLicenseCode must look like AL-1234-5678' };
    }
    replaceLicenseCode = b.replaceLicenseCode;
  }

  return {
    ok: true,
    body: {
      firstName,
      lastName,
      gender: b.gender as 'M' | 'F',
      dateOfBirth: b.dateOfBirth,
      nationality: b.nationality.toUpperCase(),
      placeOfBirth,
      birthCountry: b.birthCountry.toUpperCase(),
      email,
      phone,
      address: {
        street: (addr.street as string).trim(),
        houseNumber: (addr.houseNumber as string).trim(),
        postalCode: (addr.postalCode as string).trim(),
        city: (addr.city as string).trim(),
        country: (addr.country as string).toUpperCase(),
      },
      isSignee: b.isSignee,
      isUbo: b.isUbo,
      uboPercentage,
      replaceLicenseCode,
    },
  };
}

export async function POST(
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
    `merchant:persons:${id}:${auth.user?.id ?? getClientIp(request.headers)}`,
    {
      limit: 10,
      windowMs: 60_000,
    },
  );
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: 'Too many person updates. Please wait and try again.' },
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

  const supabaseAdmin = createAdminClient();

  // Resolve the merchant + legal form so we can map signee/UBO booleans onto
  // Pay.nl's enum (alone/shared, direct/pseudo).
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, paynl_merchant_id, legal_form')
    .eq('id', id)
    .single();
  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }
  if (!org.paynl_merchant_id) {
    return NextResponse.json(
      { error: 'Organization has no Pay.nl merchant yet — onboard first.' },
      { status: 409 },
    );
  }

  const legalForm = (org.legal_form ?? 'other') as LegalForm;
  const authorizedToSign = body.isSignee
    ? PSEUDO_UBO_FORMS.includes(legalForm)
      ? 'shared'
      : 'alone'
    : 'no';
  const ubo = body.isUbo
    ? PSEUDO_UBO_FORMS.includes(legalForm)
      ? 'pseudo'
      : 'direct'
    : 'no';

  const personPayload: MerchantPerson = {
    clientRef: crypto.randomUUID(),
    firstName: body.firstName,
    lastName: body.lastName,
    gender: body.gender,
    dateOfBirth: body.dateOfBirth,
    nationality: body.nationality,
    email: body.email,
    phone: body.phone,
    address: body.address,
    placeOfBirth: body.placeOfBirth,
    birthCountry: body.birthCountry,
    authorizedToSign,
    ubo,
    uboPercentage: body.uboPercentage,
  };

  // Step 1: if replacing a placeholder, delete it first. We allow this to
  // fail with 404 (license already gone) but bubble anything else so the
  // admin can retry knowing the placeholder still exists.
  if (body.replaceLicenseCode) {
    try {
      await deleteLicense(body.replaceLicenseCode);
    } catch (err) {
      if (err instanceof PayNLError && err.status === 404) {
        // Already removed — proceed.
      } else if (err instanceof PayNLError) {
        console.error('[Alliance] deleteLicense failed', {
          organizationId: id,
          licenseCode: body.replaceLicenseCode,
          status: err.status,
          body: redactPII(err.body),
        });
        return NextResponse.json(
          {
            error: `Pay.nl rejected DELETE of placeholder license ${body.replaceLicenseCode} (HTTP ${err.status}).`,
            paynlBody: redactPII(err.body),
          },
          { status: 502 },
        );
      } else {
        console.error('[Alliance] Unexpected error deleting license', err);
        return NextResponse.json({ error: 'Unexpected error deleting placeholder license' }, { status: 500 });
      }
    }
  }

  // Step 2: create the new license at Pay.nl with full person data.
  let newLicenseCode: string;
  try {
    const created = await createLicense({
      merchantCode: org.paynl_merchant_id,
      person: personPayload,
    });
    newLicenseCode = created.licenseCode;
  } catch (err) {
    if (err instanceof PayNLAllianceNotActivatedError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof PayNLError) {
      console.error('[Alliance] createLicense failed', {
        organizationId: id,
        status: err.status,
        body: redactPII(err.body),
      });
      return NextResponse.json(
        {
          error:
            body.replaceLicenseCode
              ? `Placeholder ${body.replaceLicenseCode} was removed but Pay.nl rejected the new license (HTTP ${err.status}). Re-submit to retry.`
              : `Pay.nl rejected the new license (HTTP ${err.status}).`,
          paynlBody: redactPII(err.body),
        },
        { status: 502 },
      );
    }
    console.error('[Alliance] Unexpected error creating license', err);
    return NextResponse.json({ error: 'Unexpected error creating license' }, { status: 500 });
  }

  // Step 3: insert local person row.
  const fullName = `${body.firstName} ${body.lastName}`;
  const { data: insertedPerson, error: insertError } = await supabaseAdmin
    .from('organization_persons')
    .insert({
      organization_id: id,
      full_name: fullName,
      gender: body.gender,
      date_of_birth: body.dateOfBirth,
      nationality: body.nationality,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address_street: body.address.street,
      address_house_number: body.address.houseNumber,
      address_postal_code: body.address.postalCode,
      address_city: body.address.city,
      address_country: body.address.country,
      is_signee: body.isSignee,
      is_ubo: body.isUbo,
      ubo_percentage: body.uboPercentage ?? null,
      paynl_license_code: newLicenseCode,
      ubo_type: body.isUbo ? ubo : null,
      birth_city: body.placeOfBirth,
      birth_country: body.birthCountry,
    })
    .select('id, full_name')
    .single();

  if (insertError || !insertedPerson) {
    console.error('[Alliance] Local person insert failed after Pay.nl create', {
      organizationId: id,
      newLicenseCode,
      error: insertError?.message,
    });
    // We deliberately don't rollback the Pay.nl-side license — losing it
    // leaves Pay.nl in an inconsistent state too. Surface the orphan so an
    // operator can reconcile.
    return NextResponse.json(
      {
        error:
          'License created at Pay.nl but local person row failed to save. ' +
          `License code: ${newLicenseCode}. Contact support for reconciliation.`,
        licenseCode: newLicenseCode,
      },
      { status: 500 },
    );
  }

  console.log('[Alliance] Person added to merchant', {
    organizationId: id,
    merchantCode: org.paynl_merchant_id,
    licenseCode: newLicenseCode,
    replacedPlaceholder: body.replaceLicenseCode ?? null,
  });

  return NextResponse.json({
    ok: true,
    personId: insertedPerson.id,
    licenseCode: newLicenseCode,
    replacedPlaceholder: body.replaceLicenseCode ?? null,
  });
}
