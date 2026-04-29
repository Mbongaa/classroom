/**
 * Pay.nl Alliance (GMS) API client — REST v2
 *
 * Bayaan Hub acts as an Alliance partner: we programmatically register
 * every mosque as a sub-merchant, collect KYC (persons + documents) and
 * submit the boarding for Pay.nl's review. Everything here targets the
 * v2 REST API at https://rest.pay.nl/v2. Schema source of truth:
 * https://rest.pay.nl/swagger/rest-v2.json.
 *
 * Flow (called by /api/organizations/{id}/merchant/*):
 *
 *   1. createMerchant(payload)                 → POST   /v2/merchants
 *      Persons are embedded in the merchant body (NOT a separate
 *      /v2/licenses call — that endpoint is for sales locations, not
 *      people). Returns merchantCode (M-XXXX-XXXX) and an embedded
 *      persons[] array with per-person codes assigned by Pay.nl.
 *
 *   2. getMerchantInfo(merchantCode)           → GET    /v2/merchants/{code}/info
 *      Tells us which documents Pay.nl now requires. We persist that
 *      list as "requested" rows in organization_kyc_documents.
 *
 *   3. addDocument({code, fileName, base64})   → POST   /v2/documents
 *      Upload each requested document, keyed by the code from step 2.
 *
 *   4. submitForReview(merchantCode)           → PATCH  /v2/boarding/{code}/ready
 *      Pay.nl Compliance review begins. Final status arrives async via
 *      boardingStatus / kycStatus (poll /info).
 *
 * Auth: Basic auth using PAYNL_TOKEN_CODE (AT-code) as username and
 * PAYNL_API_TOKEN as password — same credentials we already use for
 * the order/mandate endpoints.
 *
 * Activation gate: every function throws PayNLAllianceNotActivatedError
 * unless PAYNL_ALLIANCE_ENABLED=true. This lets us ship the code before
 * Pay.nl formally flips the alliance flag on our account.
 *
 * Env vars:
 *   PAYNL_ALLIANCE_ENABLED        Must be "true" to reach Pay.nl at all.
 *   PAYNL_REFERRAL_PROFILE_CODE   Package code (CP-xxxx-xxxx). Required
 *                                 for alliance partner calls — discover
 *                                 yours via GET /v2/packages.
 *   PAYNL_CONNECTION_TYPE         Defaults to "ALLIANCE". Other values
 *                                 per spec: BP, ISO, FI, SP, CPSP.
 */

import { getPayNLAuth, paynlRequest, PayNLError } from './paynl';

// ---------------------------------------------------------------------------
// Activation gate
// ---------------------------------------------------------------------------

export class PayNLAllianceNotActivatedError extends Error {
  constructor(functionName: string) {
    super(
      `Pay.nl Alliance API is not yet activated. Called ${functionName}. ` +
        `Set PAYNL_ALLIANCE_ENABLED=true after Alliance rights are granted.`,
    );
    this.name = 'PayNLAllianceNotActivatedError';
  }
}

export function isAllianceEnabled(): boolean {
  return process.env.PAYNL_ALLIANCE_ENABLED === 'true';
}

function assertAllianceEnabled(functionName: string): void {
  if (!isAllianceEnabled()) {
    throw new PayNLAllianceNotActivatedError(functionName);
  }
}

function getRestBase(): string {
  return process.env.PAYNL_REST_BASE_URL || 'https://rest.pay.nl';
}

// ---------------------------------------------------------------------------
// BIC derivation (NL IBANs)
//
// Pay.nl requires a BIC alongside the IBAN on clearingAccounts. For NL
// IBANs the 4-char bank code at positions 5-8 maps 1:1 to a well-known
// BIC, so we derive it rather than asking for another form field. Foreign
// IBANs fall back to whatever the caller passes.
// ---------------------------------------------------------------------------

const NL_BIC_BY_BANK_CODE: Record<string, string> = {
  ABNA: 'ABNANL2A',
  INGB: 'INGBNL2A',
  RABO: 'RABONL2U',
  SNSB: 'SNSBNL2A',
  TRIO: 'TRIONL2U',
  ASNB: 'ASNBNL21',
  KNAB: 'KNABNL2H',
  BUNQ: 'BUNQNL2A',
  RBRB: 'RBRBNL21',
  FVLB: 'FVLBNL22',
  DEUT: 'DEUTNL2N',
  FBHL: 'FBHLNL2A',
  NNBA: 'NNBANL2G',
  HAND: 'HANDNL2A',
  BCIT: 'BCITNL2A',
  AEGO: 'AEGONL2U',
  BOFA: 'BOFANLNX',
  COBA: 'COBANL2X',
  GILL: 'GILLNL2A',
  HSBC: 'HSBCNL2A',
  LOCY: 'LOCYNL2A',
  LPLN: 'LPLNNL2F',
  NWAB: 'NWABNL2G',
  UGBI: 'UGBINL2A',
};

/** Derive the BIC from a Dutch IBAN. Returns null for non-NL or unknown banks. */
export function deriveBicFromIban(iban: string): string | null {
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^NL[0-9]{2}[A-Z]{4}[0-9]{10}$/.test(clean)) return null;
  const bankCode = clean.slice(4, 8);
  return NL_BIC_BY_BANK_CODE[bankCode] ?? null;
}

/** Default Pay.nl category code when the caller doesn't override. Mosque
 * donations in NL use "Charity (ANBI state)" which maps to CY-2010-8020
 * and is available across Alliance packages. */
export const DEFAULT_PAYNL_CATEGORY_CODE =
  process.env.PAYNL_DEFAULT_CATEGORY_CODE || 'CY-2010-8020';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/**
 * Dutch legal forms Pay.nl accepts. The wire value sent to Pay.nl is the
 * string itself (lower-cased). Verify the accepted enum against the GMS
 * OpenAPI spec on first sandbox call — Pay.nl may normalise internally.
 */
export type LegalForm =
  | 'eenmanszaak'
  | 'vof'
  | 'maatschap'
  | 'bv'
  | 'nv'
  | 'stichting'
  | 'vereniging'
  | 'cooperatie'
  | 'other';

export interface PayNLAddress {
  street: string;
  houseNumber: string;
  /** May include a suffix ("12A", "12 bis"). Pay.nl accepts a separate field in some forms; keep as single string. */
  houseNumberSuffix?: string;
  postalCode: string;
  city: string;
  /** ISO 3166-1 alpha-2, e.g. "NL". */
  country: string;
}

/** Merchant lifecycle values Pay.nl reports on the merchant record. */
export type BoardingStatus =
  | 'REGISTERED'
  | 'ONBOARDING'
  | 'ACCEPTED'
  | 'SUSPENDED'
  | 'OFFBOARDED';

export type MerchantStatus = 'ACTIVE' | 'INACTIVE';
export type PayoutStatus = 'ENABLED' | 'DISABLED';

// ---------------------------------------------------------------------------
// 1a. getCompanyTypes — GET /v2/companytypes
//
// Pay.nl's /v2/merchants endpoint takes a numeric companyTypeId, not a
// string like "stichting". We fetch the list once per lambda lifetime
// and resolve by matching our internal LegalForm enum against Pay.nl's
// translated names (Dutch primary, English fallback).
// ---------------------------------------------------------------------------

interface PayNLCompanyType {
  id: number;
  name: string;
  countryCode?: string;
  translations?: { name?: Record<string, string> };
}

let cachedCompanyTypes: PayNLCompanyType[] | null = null;

export async function getCompanyTypes(
  countryCode = 'NL',
): Promise<PayNLCompanyType[]> {
  assertAllianceEnabled('getCompanyTypes');
  if (cachedCompanyTypes) {
    return cachedCompanyTypes.filter(
      (t) => !t.countryCode || t.countryCode === countryCode,
    );
  }
  const raw = await paynlRequest<unknown>(getRestBase(), '/v2/companytypes', 'GET');
  const root = raw as Record<string, unknown> | null;
  const arr =
    (root?.companyTypes as PayNLCompanyType[] | undefined) ??
    (root?.data as PayNLCompanyType[] | undefined) ??
    (Array.isArray(raw) ? (raw as PayNLCompanyType[]) : []);
  cachedCompanyTypes = arr;
  return arr.filter((t) => !t.countryCode || t.countryCode === countryCode);
}

/**
 * Match our internal LegalForm enum to Pay.nl's companyTypeId. Pay.nl's
 * translation keys vary (`nl_NL`, `en_GB`), so we compare normalised names.
 */
export async function resolveCompanyTypeId(form: LegalForm): Promise<string> {
  const types = await getCompanyTypes('NL');
  const needles = LEGAL_FORM_MATCHERS[form] ?? [form];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const needlesNorm = needles.map(norm);

  const found = types.find((t) => {
    const candidates = [
      t.name,
      t.translations?.name?.nl_NL,
      t.translations?.name?.en_GB,
      t.translations?.name?.en_US,
    ].filter((s): s is string => typeof s === 'string');
    return candidates.some((c) =>
      needlesNorm.some((n) => norm(c).includes(n) || n.includes(norm(c))),
    );
  });

  if (!found) {
    throw new PayNLError(
      502,
      { availableTypes: types.map((t) => ({ id: t.id, name: t.name })) },
      `No Pay.nl companyTypeId matched legalForm="${form}". Check /v2/companytypes.`,
    );
  }
  return String(found.id);
}

/**
 * Needle words to look for in Pay.nl's company-type names when resolving
 * a LegalForm. Order matters: first match wins.
 */
const LEGAL_FORM_MATCHERS: Record<LegalForm, string[]> = {
  eenmanszaak: ['eenmanszaak', 'soleproprietor', 'soletrader'],
  vof: ['vof', 'vennootschaponderfirma', 'generalpartnership'],
  maatschap: ['maatschap', 'partnership'],
  bv: ['beslotenvennootschap', 'privatelimited', ' bv'],
  nv: ['naamlozevennootschap', 'publiclimited', ' nv'],
  stichting: ['stichting', 'foundation'],
  vereniging: ['vereniging', 'association'],
  cooperatie: ['cooperatie', 'coöperatie', 'cooperative'],
  other: ['other', 'overig'],
};

// ---------------------------------------------------------------------------
// 1b. createMerchant — POST /v2/merchants
//
// Persons are embedded in this single call — there's no separate /v2/licenses
// endpoint for people. Pay.nl returns the merchant record with an embedded
// persons[] that carries per-person codes we store locally.
// ---------------------------------------------------------------------------

/** Pay.nl's signatory enum. "alone" = may sign individually; "shared" = needs
 * co-signer; "no" = not authorised. */
export type AuthorizedToSign = 'alone' | 'shared' | 'no';

/** Pay.nl's UBO enum. "pseudo" is what you use for stichting/foundation board
 * members when no natural person owns >25%. */
export type UboType = 'no' | 'direct' | 'indirect' | 'pseudo';

export interface MerchantPerson {
  /** Stable client-side id; echoed so we can map Pay.nl's personCode back. */
  clientRef: string;
  firstName: string;
  lastName: string;
  /** Pay.nl V2 enum: "M" | "F". Required by Pay.nl Compliance even though the
   * V2 spec marks it optional — when absent, Compliance will block boarding. */
  gender?: 'M' | 'F';
  /** ISO date "YYYY-MM-DD". */
  dateOfBirth: string;
  /** ISO 3166-1 alpha-2, e.g. "NL". */
  nationality: string;
  email?: string;
  phone?: string;
  /** Locale for person-facing comms, e.g. "nl_NL". */
  language?: string;
  address: PayNLAddress;
  authorizedToSign: AuthorizedToSign;
  ubo: UboType;
  /** Required when ubo !== "no". For pseudo-UBOs, use 100/N equal split. */
  uboPercentage?: number;
  /** Short free-text description of the person's relationship to the merchant. */
  relationshipDescription?: string;
  /** Politically exposed person flag. Defaults to false. */
  pep?: boolean;
  /** City/town of birth. Not in the V2 spec but Pay.nl Compliance asks for it
   * via the portal when missing. We forward it as an extra hint and also
   * store it locally so the dashboard can show it. */
  placeOfBirth?: string;
  /** ISO 3166-1 alpha-2 country of birth. Same caveat as placeOfBirth. */
  birthCountry?: string;
}

export interface CreateMerchantPayload {
  /** Legal business name as registered with KvK. */
  legalName: string;
  /** Trading name shown on checkout screens. */
  publicName: string;
  /** Internal LegalForm — resolved to companyTypeId at request time. */
  legalForm: LegalForm;
  /** KvK (Dutch Chamber of Commerce) number. 8 digits. */
  coc: string;
  /** Optional VAT id. */
  vat?: string;
  /** Primary contact email for the merchant. */
  contactEmail: string;
  /** Phone with international prefix (+31...). */
  contactPhone?: string;
  /** IBAN where settlements should be paid. */
  iban: string;
  /** Account holder name (must match IBAN). */
  ibanOwner: string;
  /** SWIFT/BIC of the bank. For NL IBANs we derive this; for foreign IBANs
   * the caller must supply it. Required by Pay.nl v2. */
  bic?: string;
  /** Address of the merchant's registered office. */
  visitAddress: PayNLAddress;
  /** Brief description of what the merchant sells/accepts donations for.
   * Also used as service.description. Must satisfy Pay.nl's minimum length. */
  businessDescription: string;
  /** URL of the merchant's public website. */
  website?: string;
  /** Merchant-level ISO country code (in addition to visitAddress.country). */
  countryCode: string;
  /** Pay.nl locale code for contracts and comms, e.g. "nl_NL". */
  contractLanguage: string;
  /** Embedded persons (signees + UBOs). Required by Pay.nl. */
  persons: MerchantPerson[];
  /** Service name shown on payer statements (Pay.nl "sales location"). */
  serviceName: string;
  /** Pay.nl category code (CY-####-####). Distinct from MCC — enumerable
   * via GET /v2/categories. */
  serviceCategoryCode: string;
  /** Canonical URL where the service publishes its offer (donation page,
   * product page, etc.). Sent as service.publication.domainUrl. */
  servicePublicationUrl: string;
}

export interface CreatedPerson {
  /** Pay.nl's per-person code. Stored on organization_persons.paynl_license_code
   * (column name kept for back-compat; semantically it's the personCode now). */
  personCode: string;
  firstName?: string;
  lastName?: string;
  /** Raw echo so the route handler can cross-reference in logs. */
  raw: Record<string, unknown>;
}

export interface CreateMerchantResponse {
  /** M-XXXX-XXXX. */
  merchantCode: string;
  /** Initial boarding state reported by Pay.nl. Usually REGISTERED. */
  boardingStatus: BoardingStatus;
  /** Usually INACTIVE until KYC completes. */
  status?: MerchantStatus;
  payoutStatus?: PayoutStatus;
  /** Persons as echoed back by Pay.nl (with assigned personCodes). */
  persons: CreatedPerson[];
  /** Raw response for logging. */
  raw: unknown;
}

/** Build the `partner` block from env. Pay.nl requires this for alliance calls. */
function buildPartnerBlock(): Record<string, unknown> | null {
  const referralProfileCode = process.env.PAYNL_REFERRAL_PROFILE_CODE;
  if (!referralProfileCode) return null;
  const connectionType = process.env.PAYNL_CONNECTION_TYPE || 'ALLIANCE';
  return { connectionType, referralProfileCode };
}

/**
 * Register a new sub-merchant (with persons embedded) under the Alliance
 * account. Returns the Pay.nl merchantCode plus per-person codes.
 */
export async function createMerchant(
  payload: CreateMerchantPayload,
): Promise<CreateMerchantResponse> {
  assertAllianceEnabled('createMerchant');

  const partner = buildPartnerBlock();
  if (!partner) {
    throw new PayNLError(
      500,
      null,
      'PAYNL_REFERRAL_PROFILE_CODE env var is required for Alliance merchant creation.',
    );
  }

  const companyTypeId = await resolveCompanyTypeId(payload.legalForm);

  const personObjects = payload.persons.map((p) => ({
    firstName: p.firstName,
    lastName: p.lastName,
    ...(p.gender ? { gender: p.gender } : {}),
    ...(p.email ? { email: p.email } : {}),
    ...(p.phone ? { phone: p.phone } : {}),
    language: p.language ?? payload.contractLanguage,
    visitAddress: {
      streetName: p.address.street,
      streetNumber: p.address.houseNumber,
      zipCode: p.address.postalCode,
      city: p.address.city,
      countryCode: p.address.country,
    },
    platform: { authorisation: 'all', authorisationGroups: [] },
    complianceData: {
      dateOfBirth: p.dateOfBirth,
      nationality: p.nationality,
      authorizedToSign: p.authorizedToSign,
      pep: p.pep ?? false,
      ubo: p.ubo,
      ...(p.ubo !== 'no' && typeof p.uboPercentage === 'number'
        ? { uboPercentage: Math.round(p.uboPercentage) }
        : {}),
      ...(p.relationshipDescription
        ? { relationshipDescription: p.relationshipDescription }
        : {}),
      // placeOfBirth + birthCountry aren't in the V2 spec but Pay.nl
      // Compliance derives them from ID-doc OCR, so passing them as
      // hints can prevent the manual portal prompt.
      ...(p.placeOfBirth ? { placeOfBirth: p.placeOfBirth } : {}),
      ...(p.birthCountry ? { birthCountry: p.birthCountry } : {}),
    },
  }));

  const merchantObject = {
    name: payload.legalName,
    publicName: payload.publicName,
    coc: payload.coc,
    ...(payload.vat ? { vat: payload.vat } : {}),
    companyTypeId,
    countryCode: payload.countryCode,
    contractLanguage: payload.contractLanguage,
    contactEmail: payload.contactEmail,
    ...(payload.contactPhone ? { contactPhone: payload.contactPhone } : {}),
    ...(payload.website ? { website: payload.website } : {}),
    clearingAccounts: [
      {
        method: 'iban',
        iban: {
          iban: payload.iban,
          ...(payload.bic ? { bic: payload.bic } : {}),
          owner: payload.ibanOwner,
        },
      },
    ],
    visitAddress: {
      streetName: payload.visitAddress.street,
      streetNumber: payload.visitAddress.houseNumber,
      zipCode: payload.visitAddress.postalCode,
      city: payload.visitAddress.city,
      countryCode: payload.visitAddress.country,
    },
    persons: personObjects,
    service: {
      name: payload.serviceName,
      description: payload.businessDescription,
      categoryCode: payload.serviceCategoryCode,
      // Pay.nl v2 `merchant.service.publication` is a plain string URL at
      // this endpoint (the `{ domainUrl }` object shape is only used by
      // ServiceConfig on /v2/services).
      publication: payload.servicePublicationUrl,
    },
  };

  const raw = await paynlRequest<unknown>(
    getRestBase(),
    '/v2/merchants',
    'POST',
    { partner, merchant: merchantObject },
  );

  return normaliseMerchantCreateResponse(raw);
}

function normaliseMerchantCreateResponse(raw: unknown): CreateMerchantResponse {
  const root = raw as Record<string, unknown> | null;
  const m = (root?.merchant ?? root?.data ?? root ?? {}) as Record<string, unknown>;

  const merchantCode =
    (m.code as string | undefined) ??
    (m.merchantCode as string | undefined) ??
    (m.id as string | undefined);

  if (!merchantCode) {
    throw new PayNLError(502, raw, 'Pay.nl did not return a merchantCode');
  }

  // Pay.nl's create response echoes persons back under `licenses[]` (their
  // internal term for the per-person compliance license record). Verified
  // empirically against POST /v2/merchants — the 201 body contains no
  // `persons` array. We accept either for forward compatibility.
  const personsArr =
    (m.persons as unknown[] | undefined) ??
    (m.licenses as unknown[] | undefined) ??
    [];
  const persons: CreatedPerson[] = personsArr.map((p) => {
    const po = (p ?? {}) as Record<string, unknown>;
    return {
      personCode: String(po.code ?? po.personCode ?? po.id ?? ''),
      firstName: po.firstName as string | undefined,
      lastName: po.lastName as string | undefined,
      raw: po,
    };
  });

  return {
    merchantCode,
    boardingStatus: (m.boardingStatus as BoardingStatus) ?? 'REGISTERED',
    status: m.status as MerchantStatus | undefined,
    payoutStatus: m.payoutStatus as PayoutStatus | undefined,
    persons,
    raw,
  };
}

// ---------------------------------------------------------------------------
// 3. getMerchantInfo — GET /v2/merchants/{code}/info
//
// Pay.nl dynamically computes which documents the merchant must supply
// based on legal form, UBO composition and risk profile. We call this
// right after createMerchant + all createLicense calls, persist the
// returned documents[] as "requested" rows, and surface them in the UI.
// ---------------------------------------------------------------------------

export interface MerchantInfoDocument {
  /** Pay.nl's upload identifier. POST /v2/documents uses this as `code`. */
  code: string;
  /** Free-text classification, e.g. "coc_extract", "id_front". */
  type: string;
  /** Lifecycle state. */
  status: 'REQUESTED' | 'UPLOADED' | 'ACCEPTED' | 'REJECTED' | string;
  /** Human label if Pay.nl supplies one. */
  name?: string;
  /** Optional merchant-facing translations. */
  translations?: Record<string, { name?: string; description?: string }>;
  /** If the doc relates to a specific person/license, Pay.nl sets one of these. */
  licenseCode?: string;
  personCode?: string;
}

/**
 * Full compliance data for one license (person) as returned by /v2/merchants/{code}/info.
 * Pay.nl uses "license" to mean the per-person compliance record.
 */
export interface MerchantInfoLicense {
  /** AL-XXXX-XXXX — the person's compliance identifier. */
  code: string;
  status?: string;
  firstName?: string;
  lastName?: string;
  /** 2-letter ISO country of birth (e.g. "NL"). */
  birthCountry?: string;
  /** City/town of birth (e.g. "Amsterdam"). */
  birthPlace?: string;
  /** Pay.nl UBO classification: "pseudo", "direct", or "no". */
  uboType?: string;
  /** Documents required for this specific person. */
  documents: MerchantInfoDocument[];
}

export interface MerchantClearingAccount {
  code: string;
  status?: string;
  method?: string;
  iban?: string;
  bic?: string;
  owner?: string;
}

/**
 * Pay.nl "service" = sales location (SL-XXXX-XXXX). Each merchant has one or
 * more, returned under `merchant.services[]` by /v2/merchants/{code}/info.
 * The active one is what we pass as `serviceId` on order/mandate creation.
 */
export interface MerchantService {
  /** SL-XXXX-XXXX. */
  code: string;
  status?: string;
  name?: string;
}

export interface MerchantInfoResponse {
  merchantCode: string;
  name?: string;
  publicName?: string;
  status?: MerchantStatus;
  boardingStatus?: BoardingStatus;
  payoutStatus?: PayoutStatus;
  /** Pay.nl pricing/contract package, e.g. "Merchant By Alliance PLUS". */
  contractPackage?: string;
  /** Email of the assigned Pay.nl Compliance account manager. */
  accountManager?: string;
  /** Date the contract was signed/accepted. Distinct from boarding ACCEPTED. */
  acceptedAt?: string;
  suspendedAt?: string;
  reviewedAt?: string;
  /** When the merchant must next undergo periodic compliance review. */
  nextReviewDate?: string;
  contractLanguage?: string;
  countryCode?: string;
  website?: string;
  clearingAccounts: MerchantClearingAccount[];
  documents: MerchantInfoDocument[];
  /** Full per-person license records (includes data fields + docs). */
  licenses: MerchantInfoLicense[];
  /** Sales locations (SL-XXXX-XXXX) registered against this merchant. */
  services: MerchantService[];
  /** First ACTIVE service.code (or first service.code if none ACTIVE), or null. */
  primaryServiceCode: string | null;
  /** Raw response kept for forward compatibility / debugging. */
  raw: unknown;
}

export async function getMerchantInfo(
  merchantCode: string,
): Promise<MerchantInfoResponse> {
  assertAllianceEnabled('getMerchantInfo');

  const raw = await paynlRequest<unknown>(
    getRestBase(),
    `/v2/merchants/${encodeURIComponent(merchantCode)}/info`,
    'GET',
  );

  const root = raw as Record<string, unknown> | null;
  const m = (root?.merchant ?? root?.data ?? root ?? {}) as Record<string, unknown>;

  // Merchant-level documents (org-scoped, no person).
  const merchantDocsRaw =
    (m.documents as unknown[] | undefined) ??
    (root?.documents as unknown[] | undefined) ??
    [];

  // Per-person documents live under licenses[].documents[] at root or under
  // merchant.licenses[]. Each license carries the personCode/licenseCode that
  // links it back to a specific signee/UBO.
  const licensesRaw =
    (m.licenses as unknown[] | undefined) ??
    (root?.licenses as unknown[] | undefined) ??
    [];

  function parseDocument(d: unknown, overrideLicenseCode?: string): MerchantInfoDocument {
    const doc = (d ?? {}) as Record<string, unknown>;
    const licenseCode =
      (doc.licenseCode ?? doc.personCode ?? overrideLicenseCode) as string | undefined;
    return {
      code: String(doc.code ?? ''),
      type: String(doc.type ?? ''),
      status: (doc.status as MerchantInfoDocument['status']) ?? 'REQUESTED',
      name: doc.name as string | undefined,
      translations: doc.translations as MerchantInfoDocument['translations'],
      licenseCode: licenseCode || undefined,
      personCode: doc.personCode as string | undefined,
    };
  }

  // Parse each license fully: data fields + per-person documents.
  const licenses: MerchantInfoLicense[] = licensesRaw.map((license) => {
    const l = (license ?? {}) as Record<string, unknown>;
    const lCode = String(l.code ?? '');
    const lDocs = (l.documents as unknown[] | undefined) ?? [];
    return {
      code: lCode,
      status: l.status as string | undefined,
      firstName: l.firstName as string | undefined,
      lastName: l.lastName as string | undefined,
      birthCountry: l.birthCountry as string | undefined,
      birthPlace: l.birthPlace as string | undefined,
      // Pay.nl uses ubo, uboType, or uboStatus for the classification.
      uboType: (l.ubo ?? l.uboType ?? l.uboStatus) as string | undefined,
      documents: lDocs.map((d) => parseDocument(d, lCode)),
    };
  });

  // Flatten all documents: merchant-level + all per-license docs, deduped by
  // `code`. Pay.nl /info sometimes echoes the same document under both
  // documents[] and licenses[].documents[]; without dedup we render the same
  // row twice in the dashboard.
  const merchantDocs = merchantDocsRaw.map((d) => parseDocument(d));
  const licenseDocs = licenses.flatMap((lic) => lic.documents);
  const seen = new Set<string>();
  const documents: MerchantInfoDocument[] = [];
  for (const d of [...merchantDocs, ...licenseDocs]) {
    const key = d.code || `${d.type}:${d.licenseCode ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    documents.push(d);
  }

  // Parse services (sales locations). Pay.nl nests them under `merchant.services[]`.
  const servicesRaw =
    (m.services as unknown[] | undefined) ??
    (root?.services as unknown[] | undefined) ??
    [];
  const services: MerchantService[] = servicesRaw.map((s) => {
    const so = (s ?? {}) as Record<string, unknown>;
    return {
      code: String(so.code ?? ''),
      status: so.status as string | undefined,
      name: so.name as string | undefined,
    };
  }).filter((s) => s.code.length > 0);
  const activeService = services.find((s) => s.status === 'ACTIVE');
  const primaryServiceCode = activeService?.code ?? services[0]?.code ?? null;

  // Parse clearingAccounts so the UI can show settlement bank info.
  const clearingRaw =
    (m.clearingAccounts as unknown[] | undefined) ??
    (root?.clearingAccounts as unknown[] | undefined) ??
    [];
  const clearingAccounts: MerchantClearingAccount[] = clearingRaw.map((c) => {
    const co = (c ?? {}) as Record<string, unknown>;
    const iban = (co.iban ?? {}) as Record<string, unknown>;
    return {
      code: String(co.code ?? ''),
      status: co.status as string | undefined,
      method: co.method as string | undefined,
      iban: iban.iban as string | undefined,
      bic: iban.bic as string | undefined,
      owner: iban.owner as string | undefined,
    };
  });

  return {
    merchantCode: String(m.code ?? m.merchantCode ?? merchantCode),
    name: m.name as string | undefined,
    publicName: m.publicName as string | undefined,
    status: m.status as MerchantStatus | undefined,
    boardingStatus: m.boardingStatus as BoardingStatus | undefined,
    payoutStatus: m.payoutStatus as PayoutStatus | undefined,
    contractPackage: m.contractPackage as string | undefined,
    accountManager: m.accountManager as string | undefined,
    acceptedAt: m.acceptedAt as string | undefined,
    suspendedAt: m.suspendedAt as string | undefined,
    reviewedAt: m.reviewedAt as string | undefined,
    nextReviewDate: m.nextReviewDate as string | undefined,
    contractLanguage: m.contractLanguage as string | undefined,
    countryCode: m.countryCode as string | undefined,
    website: m.website as string | undefined,
    clearingAccounts,
    documents,
    licenses,
    services,
    primaryServiceCode,
    raw,
  };
}

// ---------------------------------------------------------------------------
// 4. addDocument — POST /v2/documents
//
// JSON body with base64-encoded file contents. Keyed by the `code` from
// getMerchantInfo()'s documents[].
// ---------------------------------------------------------------------------

export interface AddDocumentParams {
  /** Value of MerchantInfoDocument.code. */
  code: string;
  fileName: string;
  /** Raw bytes. Will be base64-encoded before sending. */
  data: Uint8Array | ArrayBuffer | Buffer;
}

export interface AddDocumentResponse {
  /** Internal Pay.nl reference for the uploaded artefact (if returned). */
  documentId?: string;
  /** Same as AddDocumentParams.code, echoed back. */
  code?: string;
  /** Final lifecycle state after ingest. */
  status: 'UPLOADED' | 'ACCEPTED' | 'REJECTED' | string;
  raw: unknown;
}

export async function addDocument(
  params: AddDocumentParams,
): Promise<AddDocumentResponse> {
  assertAllianceEnabled('addDocument');

  const base64 = toBase64(params.data);

  const raw = await paynlRequest<unknown>(getRestBase(), '/v2/documents', 'POST', {
    code: params.code,
    fileName: params.fileName,
    documentFile: base64,
  });

  const root = raw as Record<string, unknown> | null;
  const d = (root?.document ?? root?.data ?? root ?? {}) as Record<string, unknown>;

  return {
    documentId: (d.id as string | undefined) ?? (d.documentId as string | undefined),
    code: (d.code as string | undefined) ?? params.code,
    status: (d.status as AddDocumentResponse['status']) ?? 'UPLOADED',
    raw,
  };
}

function toBase64(input: Uint8Array | ArrayBuffer | Buffer): string {
  if (Buffer.isBuffer(input)) return input.toString('base64');
  if (input instanceof ArrayBuffer) return Buffer.from(new Uint8Array(input)).toString('base64');
  // Uint8Array
  const view = input as Uint8Array;
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('base64');
}

// ---------------------------------------------------------------------------
// 5. updateLicense — PATCH /v2/licenses/{code}
//
// Updates a person's compliance data fields on an existing license.
// Used after onboarding to supply birth country and other required fields.
// ---------------------------------------------------------------------------

export interface UpdateLicenseParams {
  /** AL-XXXX-XXXX code returned at onboarding or from getMerchantInfo. */
  licenseCode: string;
  /** 2-letter ISO country code (e.g. "NL"). */
  birthCountry?: string;
  /** City/town of birth (e.g. "Amsterdam"). */
  birthPlace?: string;
}

export async function updateLicense(params: UpdateLicenseParams): Promise<void> {
  assertAllianceEnabled('updateLicense');

  const body: Record<string, unknown> = {};
  if (params.birthCountry) body.birthCountry = params.birthCountry;
  if (params.birthPlace) body.birthPlace = params.birthPlace;

  if (Object.keys(body).length === 0) return;

  await paynlRequest<unknown>(
    getRestBase(),
    `/v2/licenses/${encodeURIComponent(params.licenseCode)}`,
    'PATCH',
    body,
  );
}

// ---------------------------------------------------------------------------
// 6. submitForReview — PATCH /v2/boarding/{code}/ready
//
// Flips the merchant from REGISTERED/ONBOARDING into the Compliance queue.
// Pay.nl then returns ACCEPTED / SUSPENDED asynchronously; poll /info to
// pick up the final status.
// ---------------------------------------------------------------------------

export interface SubmitForReviewResponse {
  boardingStatus: BoardingStatus;
  raw: unknown;
}

export async function submitForReview(
  merchantCode: string,
): Promise<SubmitForReviewResponse> {
  assertAllianceEnabled('submitForReview');

  const raw = await paynlRequest<unknown>(
    getRestBase(),
    `/v2/boarding/${encodeURIComponent(merchantCode)}/ready`,
    'PATCH',
  );

  const root = raw as Record<string, unknown> | null;
  const m = (root?.merchant ?? root?.data ?? root ?? {}) as Record<string, unknown>;

  return {
    boardingStatus: (m.boardingStatus as BoardingStatus) ?? 'ONBOARDING',
    raw,
  };
}

// ---------------------------------------------------------------------------
// 6. getMerchant — GET /v2/merchants/{code}
//
// Lightweight status probe. Use this when the UI wants a quick refresh
// without the documents[] payload that /info carries.
// ---------------------------------------------------------------------------

export interface MerchantSummary {
  merchantCode: string;
  name?: string;
  status?: MerchantStatus;
  boardingStatus?: BoardingStatus;
  payoutStatus?: PayoutStatus;
  raw: unknown;
}

export async function getMerchant(merchantCode: string): Promise<MerchantSummary> {
  assertAllianceEnabled('getMerchant');

  const raw = await paynlRequest<unknown>(
    getRestBase(),
    `/v2/merchants/${encodeURIComponent(merchantCode)}`,
    'GET',
  );

  const root = raw as Record<string, unknown> | null;
  const m = (root?.merchant ?? root?.data ?? root ?? {}) as Record<string, unknown>;

  return {
    merchantCode: String(m.code ?? m.merchantCode ?? merchantCode),
    name: m.name as string | undefined,
    status: m.status as MerchantStatus | undefined,
    boardingStatus: m.boardingStatus as BoardingStatus | undefined,
    payoutStatus: m.payoutStatus as PayoutStatus | undefined,
    raw,
  };
}

// ---------------------------------------------------------------------------
// 7. createLicense — POST /v2/licenses
//
// Creates a brand-new person/license under an existing merchant. Required to
// add board members after the initial onboarding (e.g. when Pay.nl auto-pulled
// licenses from the KvK extract and we need to populate them).
//
// Note: PATCH /v2/licenses/{code} can only update complianceData + a few
// non-person fields. To "fix" an empty placeholder license you must DELETE
// it first, then POST a new one with full firstName/lastName/gender/address
// data — see deleteLicense() below.
// ---------------------------------------------------------------------------

export interface CreateLicenseParams {
  /** Pay.nl merchant code (M-XXXX-XXXX) the license attaches to. */
  merchantCode: string;
  person: MerchantPerson;
  /** Pay.nl locale tag (e.g. "nl_NL"). Falls back to person.language → "nl_NL". */
  contractLanguage?: string;
}

export interface CreateLicenseResponse {
  licenseCode: string;
  raw: unknown;
}

export async function createLicense(
  params: CreateLicenseParams,
): Promise<CreateLicenseResponse> {
  assertAllianceEnabled('createLicense');

  const p = params.person;
  const personObject = {
    firstName: p.firstName,
    lastName: p.lastName,
    ...(p.gender ? { gender: p.gender } : {}),
    ...(p.email ? { email: p.email } : {}),
    ...(p.phone ? { phone: p.phone } : {}),
    language: p.language ?? params.contractLanguage ?? 'nl_NL',
    visitAddress: {
      streetName: p.address.street,
      streetNumber: p.address.houseNumber,
      zipCode: p.address.postalCode,
      city: p.address.city,
      countryCode: p.address.country,
    },
    platform: { authorisation: 'all', authorisationGroups: [] },
    complianceData: {
      dateOfBirth: p.dateOfBirth,
      nationality: p.nationality,
      authorizedToSign: p.authorizedToSign,
      pep: p.pep ?? false,
      ubo: p.ubo,
      ...(p.ubo !== 'no' && typeof p.uboPercentage === 'number'
        ? { uboPercentage: Math.round(p.uboPercentage) }
        : {}),
      ...(p.relationshipDescription
        ? { relationshipDescription: p.relationshipDescription }
        : {}),
      // Off-spec hints; Pay.nl V2 ignores unknown fields and we keep the
      // values locally for the dashboard.
      ...(p.placeOfBirth ? { placeOfBirth: p.placeOfBirth } : {}),
      ...(p.birthCountry ? { birthCountry: p.birthCountry } : {}),
    },
  };

  const raw = await paynlRequest<unknown>(getRestBase(), '/v2/licenses', 'POST', {
    merchantCode: params.merchantCode,
    person: personObject,
  });

  const root = raw as Record<string, unknown> | null;
  const license = (root?.license ?? root?.data ?? root ?? {}) as Record<string, unknown>;
  const licenseCode =
    (license.code as string | undefined) ??
    (license.licenseCode as string | undefined) ??
    (license.id as string | undefined);

  if (!licenseCode) {
    throw new PayNLError(502, raw, 'Pay.nl POST /v2/licenses did not return a licenseCode');
  }
  return { licenseCode, raw };
}

// ---------------------------------------------------------------------------
// 8. deleteLicense — DELETE /v2/licenses/{code}
//
// Removes a license from a merchant. Used to clear empty placeholder licenses
// before swapping in a new one with full person data.
// ---------------------------------------------------------------------------

export async function deleteLicense(licenseCode: string): Promise<void> {
  assertAllianceEnabled('deleteLicense');
  await paynlRequest<unknown>(
    getRestBase(),
    `/v2/licenses/${encodeURIComponent(licenseCode)}`,
    'DELETE',
  );
}

// ---------------------------------------------------------------------------
// 9. listLicenses — GET /v2/licenses?merchant={code}
//
// Returns the full PersonLicense list for a merchant: code, name (often null
// for placeholders), language, complianceData ({ubo, uboPercentage,
// authorizedToSign, pep, pepDescription, relationshipDescription}),
// notificationGroup, platform, documents[], roles, timestamps.
//
// The /info endpoint strips empty fields aggressively, so this is the only
// reliable way to see per-license complianceData (which is what tells us
// which placeholder slots Pay.nl is waiting on).
// ---------------------------------------------------------------------------

export interface PersonLicenseFromList {
  code: string;
  /** Combined display name. Often null/empty for auto-created placeholders. */
  name: string | null;
  language?: string;
  complianceData: {
    authorizedToSign?: AuthorizedToSign;
    pep?: boolean;
    pepDescription?: string | null;
    ubo?: UboType;
    uboPercentage?: number;
    relationshipDescription?: string | null;
    dateOfBirth?: string | null;
    nationality?: string | null;
  };
  documents: MerchantInfoDocument[];
  roles?: { primaryContactPerson?: boolean; internalAdministrator?: boolean };
  createdBy?: string | null;
  createdAt?: string | null;
}

export async function listLicenses(
  merchantCode: string,
): Promise<PersonLicenseFromList[]> {
  assertAllianceEnabled('listLicenses');

  const raw = await paynlRequest<unknown>(
    getRestBase(),
    `/v2/licenses?merchant=${encodeURIComponent(merchantCode)}`,
    'GET',
  );
  const root = raw as Record<string, unknown> | null;
  const arr =
    (root?.licenses as unknown[] | undefined) ??
    (Array.isArray(raw) ? (raw as unknown[]) : []);

  return arr.map((entry) => {
    const l = (entry ?? {}) as Record<string, unknown>;
    const cd = (l.complianceData ?? {}) as Record<string, unknown>;
    const docs = ((l.documents as unknown[] | undefined) ?? []).map((d) => {
      const doc = (d ?? {}) as Record<string, unknown>;
      return {
        code: String(doc.code ?? ''),
        type: String(doc.type ?? ''),
        status:
          (doc.status as MerchantInfoDocument['status']) ?? 'REQUESTED',
        name: doc.name as string | undefined,
        translations: doc.translations as MerchantInfoDocument['translations'],
        licenseCode: l.code as string | undefined,
      };
    });
    return {
      code: String(l.code ?? ''),
      name: (l.name as string | null) ?? null,
      language: l.language as string | undefined,
      complianceData: {
        authorizedToSign: cd.authorizedToSign as AuthorizedToSign | undefined,
        pep: cd.pep as boolean | undefined,
        pepDescription: (cd.pepDescription as string | null) ?? null,
        ubo: cd.ubo as UboType | undefined,
        uboPercentage:
          typeof cd.uboPercentage === 'number'
            ? (cd.uboPercentage as number)
            : undefined,
        relationshipDescription:
          (cd.relationshipDescription as string | null) ?? null,
        dateOfBirth: (cd.dateOfBirth as string | null) ?? null,
        nationality: (cd.nationality as string | null) ?? null,
      },
      documents: docs,
      roles: l.roles as
        | { primaryContactPerson?: boolean; internalAdministrator?: boolean }
        | undefined,
      createdBy: (l.createdBy as string | null) ?? null,
      createdAt: (l.createdAt as string | null) ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Legacy v4 API: Service.enablePaymentOption
//
// SEPA direct-debit (and certain other alternative payment methods) cannot
// be toggled via the v2 REST API used everywhere else in this client; Pay.nl
// only exposes that toggle on the older form-encoded endpoint at
// rest-api.pay.nl/v4. Same Basic auth, different host + payload shape.
// ---------------------------------------------------------------------------

/** Pay.nl payment-method ID for SEPA direct debit (label "Incasso"). */
export const SEPA_DIRECT_DEBIT_PAYMENT_METHOD_ID = 137;

function getLegacyApiBase(): string {
  return process.env.PAYNL_LEGACY_API_BASE_URL || 'https://rest-api.pay.nl';
}

export interface EnablePaymentOptionParams {
  serviceCode: string;
  paymentMethodId: number;
  /**
   * The "Payment bank info" label shown on the donor's bank statement.
   * Max ~30 characters per Pay.nl docs. Required for SEPA direct debit.
   */
  description: string;
  /**
   * Org's terms-and-conditions / contact URL — Pay.nl shows this to donors
   * during the SEPA mandate flow. Required for SEPA direct debit.
   */
  webURL: string;
}

export interface EnablePaymentOptionResponse {
  /** True when Pay.nl returned result=1 (request accepted). */
  ok: boolean;
  /** Pay.nl's errorId (e.g. "105") on failure, empty on success. */
  errorId: string;
  /** Pay.nl's errorMessage on failure, empty on success. */
  errorMessage: string;
}

/**
 * Enable a payment option on a Pay.nl service (sales location). For SEPA
 * direct debit, this is what flips PAY-3000 ("service does not have
 * directdebit enabled") into a working mandate flow.
 *
 * Returns `{ ok: false, ... }` rather than throwing on Pay.nl-side errors
 * so callers can persist a `failed:<reason>` state without try/catch.
 */
export async function enableServicePaymentOption(
  params: EnablePaymentOptionParams,
): Promise<EnablePaymentOptionResponse> {
  assertAllianceEnabled('enableServicePaymentOption');

  const body = new URLSearchParams();
  body.set('serviceId', params.serviceCode);
  body.set('paymentProfileId', String(params.paymentMethodId));
  body.set('settings[webURL]', params.webURL);
  body.set('settings[description]', params.description);

  const url = `${getLegacyApiBase()}/v4/Service/enablePaymentOption/json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getPayNLAuth(),
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const text = await response.text();
  let parsed: { request?: { result?: string; errorId?: string; errorMessage?: string } } = {};
  try {
    parsed = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      errorId: 'parse',
      errorMessage: `Pay.nl returned non-JSON (${response.status}): ${text.slice(0, 200)}`,
    };
  }

  // Legacy API always returns 200 — `request.result` is the truth value.
  const req = parsed.request ?? {};
  const ok = req.result === '1';
  return {
    ok,
    errorId: req.errorId ?? '',
    errorMessage: req.errorMessage ?? '',
  };
}

// ---------------------------------------------------------------------------
// Error-path re-export — single import surface for API routes.
// ---------------------------------------------------------------------------

export { PayNLError };
