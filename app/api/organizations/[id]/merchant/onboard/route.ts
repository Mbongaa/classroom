import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  createMerchant,
  isAllianceEnabled,
  PayNLAllianceNotActivatedError,
  PayNLError,
  type CreateMerchantPayload,
  type LegalForm,
  type MerchantPerson,
} from '@/lib/paynl-alliance';

/**
 * POST /api/organizations/[id]/merchant/onboard
 *
 * Submit KYC / business details + signees + UBOs to register this
 * organization as a Pay.nl sub-merchant under the Bayaan Hub Alliance
 * account.
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
 *   - A row in `organization_persons` per signee/UBO submitted
 *
 * Document uploads (KvK extract, UBO extract, ID copies, bank proof) are
 * handled by the separate /merchant/documents endpoint, typically right
 * after a successful onboard while kyc_status is still 'submitted'.
 */

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KVK_RE = /^[0-9]{8}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MCC_RE = /^[0-9]{4}$/;

const LEGAL_FORMS: readonly LegalForm[] = [
  'eenmanszaak',
  'vof',
  'maatschap',
  'bv',
  'nv',
  'stichting',
  'vereniging',
  'cooperatie',
  'other',
];

/** Legal forms where UBO declarations are legally required. */
const UBO_REQUIRED_FORMS: readonly LegalForm[] = [
  'vof',
  'maatschap',
  'bv',
  'nv',
  'stichting',
  'vereniging',
  'cooperatie',
];

interface OnboardBody extends CreateMerchantPayload {}

function validatePerson(
  raw: unknown,
  index: number,
): { ok: true; person: MerchantPerson } | { ok: false; error: string } {
  const prefix = `persons[${index}]`;
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: `${prefix} must be an object` };
  }
  const p = raw as Record<string, unknown>;

  if (typeof p.clientRef !== 'string' || p.clientRef.trim().length === 0) {
    return { ok: false, error: `${prefix}.clientRef is required` };
  }
  if (typeof p.fullName !== 'string' || p.fullName.trim().length === 0) {
    return { ok: false, error: `${prefix}.fullName is required` };
  }
  if (typeof p.dateOfBirth !== 'string' || !DATE_RE.test(p.dateOfBirth)) {
    return { ok: false, error: `${prefix}.dateOfBirth must be YYYY-MM-DD` };
  }
  const dob = new Date(p.dateOfBirth + 'T00:00:00Z');
  if (Number.isNaN(dob.getTime())) {
    return { ok: false, error: `${prefix}.dateOfBirth is not a real date` };
  }
  const ageMs = Date.now() - dob.getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 18 || ageYears > 120) {
    return { ok: false, error: `${prefix}.dateOfBirth implies an implausible age` };
  }
  if (typeof p.nationality !== 'string' || p.nationality.length !== 2) {
    return { ok: false, error: `${prefix}.nationality must be a 2-letter ISO code` };
  }
  if (p.email !== undefined && (typeof p.email !== 'string' || !EMAIL_RE.test(p.email))) {
    return { ok: false, error: `${prefix}.email must be a valid email if provided` };
  }
  if (p.phone !== undefined && typeof p.phone !== 'string') {
    return { ok: false, error: `${prefix}.phone must be a string if provided` };
  }
  if (!p.address || typeof p.address !== 'object') {
    return { ok: false, error: `${prefix}.address is required` };
  }
  const addr = p.address as Record<string, unknown>;
  for (const key of ['street', 'houseNumber', 'postalCode', 'city'] as const) {
    if (typeof addr[key] !== 'string' || (addr[key] as string).trim().length === 0) {
      return { ok: false, error: `${prefix}.address.${key} is required` };
    }
  }
  if (typeof addr.country !== 'string' || addr.country.length !== 2) {
    return { ok: false, error: `${prefix}.address.country must be a 2-letter ISO code` };
  }
  if (typeof p.isSignee !== 'boolean') {
    return { ok: false, error: `${prefix}.isSignee must be a boolean` };
  }
  if (typeof p.isUbo !== 'boolean') {
    return { ok: false, error: `${prefix}.isUbo must be a boolean` };
  }
  if (!p.isSignee && !p.isUbo) {
    return { ok: false, error: `${prefix} must be a signee, a UBO, or both` };
  }
  let uboPct: number | undefined;
  if (p.isUbo) {
    if (typeof p.uboPercentage !== 'number' || p.uboPercentage <= 0 || p.uboPercentage > 100) {
      return {
        ok: false,
        error: `${prefix}.uboPercentage must be >0 and ≤100 when isUbo=true`,
      };
    }
    uboPct = p.uboPercentage;
  }

  return {
    ok: true,
    person: {
      clientRef: (p.clientRef as string).trim(),
      fullName: (p.fullName as string).trim(),
      dateOfBirth: p.dateOfBirth as string,
      nationality: (p.nationality as string).toUpperCase(),
      email: p.email ? (p.email as string).trim() : undefined,
      phone: p.phone ? (p.phone as string).trim() : undefined,
      address: {
        street: (addr.street as string).trim(),
        houseNumber: (addr.houseNumber as string).trim(),
        postalCode: (addr.postalCode as string).trim(),
        city: (addr.city as string).trim(),
        country: (addr.country as string).toUpperCase(),
      },
      isSignee: p.isSignee,
      isUbo: p.isUbo,
      uboPercentage: uboPct,
    },
  };
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
  if (typeof r.legalForm !== 'string' || !LEGAL_FORMS.includes(r.legalForm as LegalForm)) {
    return { ok: false, error: `legalForm must be one of: ${LEGAL_FORMS.join(', ')}` };
  }
  const legalForm = r.legalForm as LegalForm;
  if (typeof r.mcc !== 'string' || !MCC_RE.test(r.mcc)) {
    return { ok: false, error: 'mcc must be a 4-digit Merchant Category Code' };
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

  // Business address
  if (!r.address || typeof r.address !== 'object') {
    return { ok: false, error: 'address is required and must be an object' };
  }
  const addr = r.address as Record<string, unknown>;
  for (const key of ['street', 'houseNumber', 'postalCode', 'city'] as const) {
    if (typeof addr[key] !== 'string' || (addr[key] as string).trim().length === 0) {
      return { ok: false, error: `address.${key} is required` };
    }
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

  // Persons: ≥1 signee, and ≥1 UBO for legal forms that require them
  if (!Array.isArray(r.persons) || r.persons.length === 0) {
    return { ok: false, error: 'persons must be a non-empty array' };
  }
  const persons: MerchantPerson[] = [];
  const seenRefs = new Set<string>();
  let uboPercentageTotal = 0;
  let hasSignee = false;
  let hasUbo = false;
  for (let i = 0; i < r.persons.length; i++) {
    const result = validatePerson(r.persons[i], i);
    if (!result.ok) return result;
    const p = result.person;
    if (seenRefs.has(p.clientRef)) {
      return { ok: false, error: `persons[${i}].clientRef "${p.clientRef}" is duplicated` };
    }
    seenRefs.add(p.clientRef);
    if (p.isSignee) hasSignee = true;
    if (p.isUbo) {
      hasUbo = true;
      uboPercentageTotal += p.uboPercentage ?? 0;
    }
    persons.push(p);
  }
  if (!hasSignee) {
    return { ok: false, error: 'At least one person must be flagged as isSignee' };
  }
  if (UBO_REQUIRED_FORMS.includes(legalForm) && !hasUbo) {
    return {
      ok: false,
      error: `legalForm "${legalForm}" requires at least one UBO`,
    };
  }
  if (uboPercentageTotal > 100.01) {
    return {
      ok: false,
      error: `UBO percentages sum to ${uboPercentageTotal.toFixed(2)}%, which exceeds 100%`,
    };
  }

  return {
    ok: true,
    body: {
      legalName: r.legalName.trim(),
      tradingName: r.tradingName.trim(),
      legalForm,
      mcc: r.mcc,
      kvkNumber: r.kvkNumber,
      vatNumber: r.vatNumber ? (r.vatNumber as string).trim() : undefined,
      contactEmail: r.contactEmail.trim(),
      contactPhone: r.contactPhone ? (r.contactPhone as string).trim() : undefined,
      iban: ibanClean,
      ibanOwner: r.ibanOwner.trim(),
      address: {
        street: (addr.street as string).trim(),
        houseNumber: (addr.houseNumber as string).trim(),
        postalCode: (addr.postalCode as string).trim(),
        city: (addr.city as string).trim(),
        country: (addr.country as string).toUpperCase(),
      },
      businessDescription: r.businessDescription.trim(),
      websiteUrl: r.websiteUrl ? (r.websiteUrl as string).trim() : undefined,
      persons,
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
      // Sync business fields so the org row is the source of truth
      contact_email: body.contactEmail,
      bank_iban: body.iban,
      bank_account_holder: body.ibanOwner,
      city: body.address.city,
      country: body.address.country,
      address_street: body.address.street,
      address_house_number: body.address.houseNumber,
      address_postal_code: body.address.postalCode,
      legal_form: body.legalForm,
      mcc: body.mcc,
      kvk_number: body.kvkNumber,
      vat_number: body.vatNumber ?? null,
      business_description: body.businessDescription,
      website_url: body.websiteUrl ?? null,
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

    // ---- 7. Persist persons (signees + UBOs) ------------------------------
    //
    // Match paynl_person_id back to our rows via clientRef. Any person Pay.nl
    // didn't return an id for still gets a local row so later doc uploads
    // can reference it (paynl_person_id stays NULL).
    const paynlPersonByRef = new Map<string, string>();
    for (const p of result.persons ?? []) {
      paynlPersonByRef.set(p.clientRef, p.paynlPersonId);
    }

    const personRows = body.persons.map((p) => ({
      organization_id: id,
      full_name: p.fullName,
      date_of_birth: p.dateOfBirth,
      nationality: p.nationality,
      email: p.email ?? null,
      phone: p.phone ?? null,
      address_street: p.address.street,
      address_house_number: p.address.houseNumber,
      address_postal_code: p.address.postalCode,
      address_city: p.address.city,
      address_country: p.address.country,
      is_signee: p.isSignee,
      is_ubo: p.isUbo,
      ubo_percentage: p.uboPercentage ?? null,
      paynl_person_id: paynlPersonByRef.get(p.clientRef) ?? null,
    }));

    const { data: insertedPersons, error: personsError } = await supabaseAdmin
      .from('organization_persons')
      .insert(personRows)
      .select('id, full_name, is_signee, is_ubo, paynl_person_id');

    if (personsError) {
      // Non-fatal for the API call — merchant creation succeeded at Pay.nl
      // and was persisted. Log so we can backfill.
      console.error('[Alliance] Failed to persist persons locally', {
        organizationId: id,
        merchantId: result.merchantId,
        error: personsError.message,
      });
    }

    console.log('[Alliance] Merchant onboarded', {
      organizationId: id,
      merchantId: result.merchantId,
      serviceId: result.serviceId,
      kycStatus: result.kycStatus,
      personCount: body.persons.length,
    });

    return NextResponse.json({
      merchantId: result.merchantId,
      serviceId: result.serviceId,
      kycStatus: result.kycStatus,
      donationsActive: result.kycStatus === 'approved',
      persons: insertedPersons ?? [],
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
