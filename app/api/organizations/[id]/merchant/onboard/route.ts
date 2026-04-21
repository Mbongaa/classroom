import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  createMerchant,
  deriveBicFromIban,
  DEFAULT_PAYNL_CATEGORY_CODE,
  getMerchantInfo,
  isAllianceEnabled,
  PayNLAllianceNotActivatedError,
  PayNLError,
  type CreateMerchantPayload,
  type LegalForm,
  type MerchantPerson,
  type MerchantInfoDocument,
} from '@/lib/paynl-alliance';
import { geocodeAddress } from '@/lib/geocoding';

/**
 * POST /api/organizations/[id]/merchant/onboard
 *
 * Registers this organization as a Pay.nl sub-merchant under the Bayaan
 * Hub Alliance account. The endpoint orchestrates four Pay.nl calls:
 *
 *   1. POST /v2/merchants              → create the merchant record
 *   2. POST /v2/licenses   (× persons)  → attach each signee/UBO
 *   3. GET  /v2/merchants/{code}/info   → read back the list of
 *                                         required KYC documents
 *   4. Persist all of the above locally so the admin UI can drive the
 *      subsequent document uploads + submit-for-review step.
 *
 * Auth: org admin or platform superadmin.
 * Guard: the organization must not already have a paynl_merchant_id.
 */

// ---------------------------------------------------------------------------
// Regex + enum constants
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KVK_RE = /^[0-9]{8}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MCC_RE = /^[0-9]{4}$/;
const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const PAYNL_CATEGORY_RE = /^[A-Z]{1,2}(-\d{4}){2,}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

/** Pay.nl's `{INVALID_LENGTH}` (PAY-2816) on service.description fires
 * well above the "any non-empty" threshold — their compliance validator
 * rejects short descriptions. 100 chars is what their public merchant
 * signup form requires; we mirror that here. */
const BUSINESS_DESCRIPTION_MIN_LENGTH = 100;

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

/** Legal forms for which UBO declarations are legally required. */
const UBO_REQUIRED_FORMS: readonly LegalForm[] = [
  'vof',
  'maatschap',
  'bv',
  'nv',
  'stichting',
  'vereniging',
  'cooperatie',
];

/** Wire shape received from the onboarding wizard. Stays UI-friendly — we
 * translate to Pay.nl's v2 field names inside the handler. */
interface OnboardBody {
  legalName: string;
  tradingName: string;
  legalForm: LegalForm;
  mcc: string;
  kvkNumber: string;
  vatNumber?: string;
  contactEmail: string;
  contactPhone?: string;
  iban: string;
  ibanOwner: string;
  /** Optional — derived from IBAN for NL accounts; required for foreign IBANs. */
  bic?: string;
  address: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    country: string;
  };
  businessDescription: string;
  websiteUrl?: string;
  /** Optional override for Pay.nl's service.categoryCode (CY-####-####). */
  serviceCategoryCode?: string;
  persons: ValidatedPerson[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidatedPerson extends MerchantPerson {
  /** Kept alongside the Pay.nl-shaped person so the DB insert can use it. */
  isSignee: boolean;
  isUbo: boolean;
  /** Original full name for the local organization_persons row. */
  fullName: string;
}

function validatePerson(
  raw: unknown,
  index: number,
  legalForm: LegalForm,
): { ok: true; person: ValidatedPerson } | { ok: false; error: string } {
  const prefix = `persons[${index}]`;
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: `${prefix} must be an object` };
  }
  const p = raw as Record<string, unknown>;

  if (typeof p.clientRef !== 'string' || p.clientRef.trim().length === 0) {
    return { ok: false, error: `${prefix}.clientRef is required` };
  }
  if (typeof p.firstName !== 'string' || p.firstName.trim().length === 0) {
    return { ok: false, error: `${prefix}.firstName is required` };
  }
  if (typeof p.lastName !== 'string' || p.lastName.trim().length === 0) {
    return { ok: false, error: `${prefix}.lastName is required` };
  }
  if (typeof p.dateOfBirth !== 'string' || !DATE_RE.test(p.dateOfBirth)) {
    return { ok: false, error: `${prefix}.dateOfBirth must be YYYY-MM-DD` };
  }
  const dob = new Date(p.dateOfBirth + 'T00:00:00Z');
  if (Number.isNaN(dob.getTime())) {
    return { ok: false, error: `${prefix}.dateOfBirth is not a real date` };
  }
  const ageYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
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

  const firstName = (p.firstName as string).trim();
  const lastName = (p.lastName as string).trim();

  // Map our booleans to Pay.nl's enum shape.
  // Stichting/vereniging boards act jointly → "shared"; otherwise "alone".
  // (Teachers/admins can override later via the settings UI when we add it.)
  const pseudoUboForms: readonly LegalForm[] = [
    'stichting',
    'vereniging',
    'cooperatie',
  ];
  const authorizedToSign = p.isSignee
    ? (pseudoUboForms.includes(legalForm) ? 'shared' : 'alone')
    : 'no';
  const ubo = p.isUbo
    ? (pseudoUboForms.includes(legalForm) ? 'pseudo' : 'direct')
    : 'no';

  return {
    ok: true,
    person: {
      clientRef: (p.clientRef as string).trim(),
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
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
      authorizedToSign,
      ubo,
      uboPercentage: uboPct,
      isSignee: p.isSignee,
      isUbo: p.isUbo,
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
  let bic: string | undefined;
  if (r.bic !== undefined) {
    if (typeof r.bic !== 'string') {
      return { ok: false, error: 'bic must be a string if provided' };
    }
    const cleanBic = r.bic.replace(/\s+/g, '').toUpperCase();
    if (!BIC_RE.test(cleanBic)) {
      return { ok: false, error: 'bic is not in a valid SWIFT/BIC format' };
    }
    bic = cleanBic;
  }
  if (!bic) {
    const derived = deriveBicFromIban(ibanClean);
    if (derived) bic = derived;
    else if (!ibanClean.startsWith('NL')) {
      return {
        ok: false,
        error:
          'bic is required for non-NL IBANs (Pay.nl rejects the merchant without it).',
      };
    }
  }

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
  const trimmedDescription = r.businessDescription.trim();
  if (trimmedDescription.length < BUSINESS_DESCRIPTION_MIN_LENGTH) {
    return {
      ok: false,
      error: `businessDescription must be at least ${BUSINESS_DESCRIPTION_MIN_LENGTH} characters (Pay.nl rejects shorter values).`,
    };
  }
  if (r.websiteUrl !== undefined && typeof r.websiteUrl !== 'string') {
    return { ok: false, error: 'websiteUrl must be a string if provided' };
  }
  if (r.websiteUrl && !URL_RE.test(r.websiteUrl.trim())) {
    return { ok: false, error: 'websiteUrl must be an absolute http(s) URL' };
  }
  if (r.serviceCategoryCode !== undefined) {
    if (typeof r.serviceCategoryCode !== 'string') {
      return { ok: false, error: 'serviceCategoryCode must be a string if provided' };
    }
    if (!PAYNL_CATEGORY_RE.test(r.serviceCategoryCode)) {
      return {
        ok: false,
        error: 'serviceCategoryCode must be a Pay.nl category code (e.g. CY-1234-5678).',
      };
    }
  }

  if (!Array.isArray(r.persons) || r.persons.length === 0) {
    return { ok: false, error: 'persons must be a non-empty array' };
  }
  const persons: ValidatedPerson[] = [];
  const seenRefs = new Set<string>();
  let uboPercentageTotal = 0;
  let hasSignee = false;
  let hasUbo = false;
  for (let i = 0; i < r.persons.length; i++) {
    const result = validatePerson(r.persons[i], i, legalForm);
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
      bic,
      address: {
        street: (addr.street as string).trim(),
        houseNumber: (addr.houseNumber as string).trim(),
        postalCode: (addr.postalCode as string).trim(),
        city: (addr.city as string).trim(),
        country: (addr.country as string).toUpperCase(),
      },
      businessDescription: trimmedDescription,
      websiteUrl: r.websiteUrl ? (r.websiteUrl as string).trim() : undefined,
      serviceCategoryCode: r.serviceCategoryCode
        ? (r.serviceCategoryCode as string).trim()
        : undefined,
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

  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

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

  // Guard: org must not already be onboarded.
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, slug, paynl_merchant_id, kyc_status, paynl_boarding_status')
    .eq('id', id)
    .single();
  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }
  if (org.paynl_merchant_id) {
    return NextResponse.json(
      {
        error:
          `Organization already has a merchant account (${org.paynl_merchant_id}). ` +
          `Current KYC status: ${org.kyc_status}. ` +
          'To re-onboard, a superadmin must first clear the merchant fields.',
      },
      { status: 409 },
    );
  }

  try {
    // ---- Step 1: POST /v2/merchants ---------------------------------------
    //
    // Pay.nl v2 takes the full merchant + persons in a single call. We
    // translate our UI-friendly OnboardBody into Pay.nl's wire shape here.
    // Pay.nl's service.publication.domainUrl must be a fully-qualified URL
    // that Compliance can load. Prefer the merchant's own website; fall
    // back to the hosted Bayaan donation page.
    const servicePublicationUrl =
      body.websiteUrl ??
      (org.slug ? `https://www.bayaan.app/donate/${org.slug}` : null);
    if (!servicePublicationUrl) {
      return NextResponse.json(
        {
          error:
            'Cannot build service.publication.domainUrl: organization has no slug and no websiteUrl was supplied.',
        },
        { status: 400 },
      );
    }

    const createPayload: CreateMerchantPayload = {
      legalName: body.legalName,
      publicName: body.tradingName,
      legalForm: body.legalForm,
      coc: body.kvkNumber,
      vat: body.vatNumber,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      iban: body.iban,
      ibanOwner: body.ibanOwner,
      bic: body.bic,
      visitAddress: body.address,
      businessDescription: body.businessDescription,
      website: body.websiteUrl,
      countryCode: body.address.country,
      contractLanguage: 'nl_NL',
      persons: body.persons,
      serviceName: body.tradingName,
      serviceCategoryCode: body.serviceCategoryCode ?? DEFAULT_PAYNL_CATEGORY_CODE,
      servicePublicationUrl,
    };
    const merchantResult = await createMerchant(createPayload);

    // Persist the freshly minted merchant id so a crash in subsequent steps
    // leaves us with something to reconcile against.
    const { error: updateError } = await supabaseAdmin
      .from('organizations')
      .update({
        paynl_merchant_id: merchantResult.merchantCode,
        paynl_boarding_status: merchantResult.boardingStatus,
        kyc_status: 'submitted',
        contact_email: body.contactEmail,
        contact_phone: body.contactPhone ?? null,
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
      })
      .eq('id', id);

    if (updateError) {
      console.error('[Alliance] Merchant created but org update failed', {
        organizationId: id,
        merchantCode: merchantResult.merchantCode,
        error: updateError.message,
      });
      return NextResponse.json(
        {
          error: 'Merchant created at Pay.nl but failed to save locally. Contact support.',
          merchantCode: merchantResult.merchantCode,
        },
        { status: 500 },
      );
    }

    // Re-geocode the updated address for the superadmin map. Fire-and-forget:
    // the KYC flow must not fail if Nominatim is slow or down.
    void (async () => {
      const coords = await geocodeAddress({
        street: body.address.street,
        houseNumber: body.address.houseNumber,
        postalCode: body.address.postalCode,
        city: body.address.city,
        country: body.address.country,
      });
      if (!coords) return;
      const { error: geoError } = await supabaseAdmin
        .from('organizations')
        .update({
          latitude: coords.lat,
          longitude: coords.lng,
          geocoded_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (geoError) console.error('[Alliance] Geocode update failed', geoError);
    })();

    // ---- Step 2: Persist persons with personCodes returned by Pay.nl ------
    //
    // Pay.nl echoes persons[] back in the create response in the same order
    // we sent them, each carrying its assigned personCode. We insert our
    // local rows with that code pre-populated (paynl_license_code column —
    // name kept for DB back-compat; semantically it's now the personCode).
    const personInsertPayload = body.persons.map((p, i) => ({
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
      paynl_license_code: merchantResult.persons[i]?.personCode || null,
    }));

    const { data: insertedPersons, error: personsError } = await supabaseAdmin
      .from('organization_persons')
      .insert(personInsertPayload)
      .select('id, full_name');

    if (personsError || !insertedPersons) {
      console.error('[Alliance] Failed to persist persons locally', {
        organizationId: id,
        merchantCode: merchantResult.merchantCode,
        error: personsError?.message,
      });
      return NextResponse.json(
        {
          error:
            'Merchant created but local person records failed to save. ' +
            'Contact support — manual reconciliation needed.',
          merchantCode: merchantResult.merchantCode,
        },
        { status: 500 },
      );
    }

    const personErrors: Array<{ clientRef: string; error: string }> = [];
    for (let i = 0; i < body.persons.length; i++) {
      if (!merchantResult.persons[i]?.personCode) {
        personErrors.push({
          clientRef: body.persons[i].clientRef,
          error: 'Pay.nl did not return a personCode for this person',
        });
      }
    }

    // ---- Step 3: GET /v2/merchants/{code}/info — sync required docs -------
    let requiredDocsRemote: MerchantInfoDocument[] = [];
    try {
      const info = await getMerchantInfo(merchantResult.merchantCode);
      requiredDocsRemote = info.documents;

      // Persist the latest boarding state (Pay.nl may have advanced it).
      if (info.boardingStatus) {
        await supabaseAdmin
          .from('organizations')
          .update({ paynl_boarding_status: info.boardingStatus })
          .eq('id', id);
      }
    } catch (err) {
      console.error('[Alliance] getMerchantInfo failed', {
        organizationId: id,
        merchantCode: merchantResult.merchantCode,
        error: err instanceof Error ? err.message : err,
      });
      // Non-fatal — admin can trigger a manual refresh later.
    }

    if (requiredDocsRemote.length > 0) {
      // Map Pay.nl's licenseCode back to our local person id so per-person
      // uploads know which row to attach to.
      const { data: personLicenseRows } = await supabaseAdmin
        .from('organization_persons')
        .select('id, paynl_license_code')
        .eq('organization_id', id);

      const localIdByLicense = new Map<string, string>();
      for (const row of personLicenseRows ?? []) {
        if (row.paynl_license_code) {
          localIdByLicense.set(row.paynl_license_code, row.id);
        }
      }

      const docRows = requiredDocsRemote.map((d) => ({
        organization_id: id,
        person_id: d.licenseCode ? (localIdByLicense.get(d.licenseCode) ?? null) : null,
        doc_type: d.type,
        paynl_document_code: d.code,
        paynl_required: true,
        translations: d.translations ?? null,
        status: mapRemoteDocStatus(d.status),
        last_synced_at: new Date().toISOString(),
      }));

      // Upsert — idempotent per (organization_id, paynl_document_code).
      const { error: docsError } = await supabaseAdmin
        .from('organization_kyc_documents')
        .upsert(docRows, {
          onConflict: 'organization_id,paynl_document_code',
          ignoreDuplicates: false,
        });

      if (docsError) {
        console.error('[Alliance] Failed to persist required docs locally', {
          organizationId: id,
          merchantCode: merchantResult.merchantCode,
          error: docsError.message,
        });
        // Non-fatal — the UI can re-fetch via /info on next page load.
      }
    }

    console.log('[Alliance] Merchant onboarded', {
      organizationId: id,
      merchantCode: merchantResult.merchantCode,
      personCount: body.persons.length,
      personErrors: personErrors.length,
      requiredDocs: requiredDocsRemote.length,
    });

    return NextResponse.json({
      merchantCode: merchantResult.merchantCode,
      boardingStatus: merchantResult.boardingStatus,
      kycStatus: 'submitted',
      persons: insertedPersons,
      requiredDocuments: requiredDocsRemote.map((d) => ({
        code: d.code,
        type: d.type,
        status: d.status,
        licenseCode: d.licenseCode ?? null,
      })),
      personErrors: personErrors.length > 0 ? personErrors : undefined,
    });
  } catch (error) {
    if (error instanceof PayNLAllianceNotActivatedError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof PayNLError) {
      console.error('[Alliance] createMerchant failed', {
        organizationId: id,
        status: error.status,
        message: error.message,
        body: error.body,
      });
      const detail = extractPayNLErrorDetail(error.body) ?? error.message;
      // If the body is null, it's almost certainly one of our own throws
      // (config missing / unexpected response shape) — return 500, not 502,
      // and skip the misleading "Pay.nl rejected" framing.
      const isLocalError = error.body == null;
      return NextResponse.json(
        {
          error: isLocalError
            ? `Onboarding failed: ${detail}`
            : `Pay.nl rejected the merchant application (HTTP ${error.status}): ${detail}`,
          paynlStatus: error.status,
          paynlBody: error.body,
        },
        { status: isLocalError ? 500 : 502 },
      );
    }
    console.error('[Alliance] Unexpected error in merchant/onboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable message from Pay.nl's error body. Pay.nl v2
 * uses several shapes, so try the common ones and fall back to JSON.
 */
function extractPayNLErrorDetail(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === 'string') return body.slice(0, 500);
  if (typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  const errorsArr = b.errors ?? b.violations ?? b.validationErrors;
  if (Array.isArray(errorsArr) && errorsArr.length > 0) {
    const parts = errorsArr
      .map((e) => {
        if (typeof e === 'string') return e;
        if (e && typeof e === 'object') {
          const r = e as Record<string, unknown>;
          const field =
            r.field ??
            r.path ??
            r.property ??
            r.propertyPath ??
            r.propertyName ??
            r.name ??
            r.key ??
            r.fieldName ??
            r.parameter;
          const msg = r.message ?? r.detail ?? r.description ?? r.error ?? r.code;
          if (field && msg) return `${field}: ${msg}`;
          if (msg) return String(msg);
          return JSON.stringify(e);
        }
        return String(e);
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join('; ').slice(0, 500);
  }

  if (typeof b.error === 'string') return b.error;
  if (b.error && typeof b.error === 'object') {
    const e = b.error as Record<string, unknown>;
    const msg = e.message ?? e.detail;
    if (typeof msg === 'string') return msg;
  }
  if (typeof b.message === 'string') return b.message;
  if (typeof b.detail === 'string') return b.detail;

  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return null;
  }
}

function mapRemoteDocStatus(
  remote: string,
): 'requested' | 'uploaded' | 'forwarded' | 'accepted' | 'rejected' {
  switch (remote?.toUpperCase()) {
    case 'REQUESTED':
      return 'requested';
    case 'UPLOADED':
      return 'uploaded';
    case 'ACCEPTED':
      return 'accepted';
    case 'REJECTED':
      return 'rejected';
    default:
      return 'requested';
  }
}
