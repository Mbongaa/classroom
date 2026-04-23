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

import { paynlRequest, PayNLError } from './paynl';

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
  /** Optional gender. Pay.nl accepts "M" | "F". */
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

export interface MerchantInfoResponse {
  merchantCode: string;
  status?: MerchantStatus;
  boardingStatus?: BoardingStatus;
  payoutStatus?: PayoutStatus;
  documents: MerchantInfoDocument[];
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

  const licenseDocsRaw: unknown[] = [];
  for (const license of licensesRaw) {
    const l = (license ?? {}) as Record<string, unknown>;
    const lCode = String(l.code ?? '');
    const lDocs = (l.documents as unknown[] | undefined) ?? [];
    for (const d of lDocs) {
      const doc = (d ?? {}) as Record<string, unknown>;
      // Preserve existing licenseCode/personCode if already set, otherwise
      // use the license's own code as the linkage key.
      licenseDocsRaw.push({
        ...doc,
        licenseCode: doc.licenseCode ?? doc.personCode ?? lCode || undefined,
      });
    }
  }

  const allDocsRaw = [...merchantDocsRaw, ...licenseDocsRaw];

  const documents: MerchantInfoDocument[] = allDocsRaw.map((d) => {
    const doc = (d ?? {}) as Record<string, unknown>;
    return {
      code: String(doc.code ?? ''),
      type: String(doc.type ?? ''),
      status: (doc.status as MerchantInfoDocument['status']) ?? 'REQUESTED',
      name: doc.name as string | undefined,
      translations: doc.translations as MerchantInfoDocument['translations'],
      licenseCode: doc.licenseCode as string | undefined,
      personCode: doc.personCode as string | undefined,
    };
  });

  return {
    merchantCode: String(m.code ?? m.merchantCode ?? merchantCode),
    status: m.status as MerchantStatus | undefined,
    boardingStatus: m.boardingStatus as BoardingStatus | undefined,
    payoutStatus: m.payoutStatus as PayoutStatus | undefined,
    documents,
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
// 5. submitForReview — PATCH /v2/boarding/{code}/ready
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
// Error-path re-export — single import surface for API routes.
// ---------------------------------------------------------------------------

export { PayNLError };
