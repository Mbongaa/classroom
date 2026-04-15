/**
 * Pay.nl Alliance (GMS) API client — REST v2
 *
 * Bayaan Hub acts as an Alliance partner: we programmatically register
 * every mosque as a sub-merchant, collect KYC (persons + documents) and
 * submit the boarding for Pay.nl's review. Everything here targets the
 * v2 REST API at https://rest.pay.nl/v2.
 *
 * Flow (called in this order by /api/organizations/{id}/merchant/*):
 *
 *   1. createMerchant(payload)                 → POST   /v2/merchants
 *      Returns merchantCode (M-XXXX-XXXX).
 *
 *   2. createLicense(merchantCode, person)     → POST   /v2/licenses
 *      Register each signee / UBO. Returns licenseCode per person.
 *
 *   3. getMerchantInfo(merchantCode)           → GET    /v2/merchants/{code}/info
 *      Tells us which documents Pay.nl now requires. We persist that
 *      list as "requested" rows in organization_kyc_documents so the
 *      admin UI can show what's outstanding.
 *
 *   4. addDocument({code, fileName, base64})   → POST   /v2/documents
 *      Upload each requested document, keyed by the code from step 3.
 *
 *   5. submitForReview(merchantCode)           → PATCH  /v2/boarding/{code}/ready
 *      Pay.nl Compliance review begins. Final status arrives async via
 *      boardingStatus / kycStatus on the merchant (poll /info).
 *
 * Auth: Basic auth using PAYNL_TOKEN_CODE (AT-code) as username and
 * PAYNL_API_TOKEN as password — same credentials we already use for
 * the order/mandate endpoints.
 *
 * Activation gate: every function throws PayNLAllianceNotActivatedError
 * unless PAYNL_ALLIANCE_ENABLED=true. This lets us ship the code before
 * Pay.nl formally flips the alliance flag on our account.
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
// 1. createMerchant — POST /v2/merchants
// ---------------------------------------------------------------------------

/**
 * Body for POST /v2/merchants.
 *
 * The top-level envelope is `{ merchant: {...}, partner?: {...} }`. We
 * represent the merchant sub-object with a flat TypeScript interface and
 * build the envelope inside createMerchant() — callers don't have to know
 * about the envelope.
 */
export interface CreateMerchantPayload {
  /** Legal business name as registered with KvK. */
  legalName: string;
  /** Trading name shown on checkout screens. */
  tradingName: string;
  /** Legal form — drives which documents / UBO rules apply server-side. */
  legalForm: LegalForm;
  /** Merchant Category Code (ISO 18245). Donations typically 8398. */
  mcc: string;
  /** KvK (Dutch Chamber of Commerce) number. 8 digits. */
  kvkNumber: string;
  /** Optional VAT id. */
  vatNumber?: string;
  /** Primary contact email for the merchant. */
  contactEmail: string;
  /** Phone with international prefix (+31...). */
  contactPhone?: string;
  /** IBAN where settlements should be paid. */
  iban: string;
  /** Account holder name (must match IBAN). */
  ibanOwner: string;
  /** Address of the merchant's registered office. */
  address: PayNLAddress;
  /** Brief description of what the merchant sells/accepts donations for. */
  businessDescription: string;
  /** URL of the merchant's public website. */
  websiteUrl?: string;
  /** ISO 4217 currency code. Defaults to "EUR" when omitted. */
  currency?: string;
}

export interface CreateMerchantResponse {
  /** M-XXXX-XXXX. */
  merchantCode: string;
  /** Initial boarding state reported by Pay.nl. Usually REGISTERED. */
  boardingStatus: BoardingStatus;
  /** Usually INACTIVE until KYC completes. */
  status?: MerchantStatus;
  payoutStatus?: PayoutStatus;
}

/**
 * Register a new sub-merchant under the Alliance account.
 *
 * On success Pay.nl returns a merchantCode (M-XXXX-XXXX). Subsequent
 * license + document operations are keyed by this code.
 */
export async function createMerchant(
  payload: CreateMerchantPayload,
): Promise<CreateMerchantResponse> {
  assertAllianceEnabled('createMerchant');

  const merchantObject = {
    name: payload.legalName,
    tradingName: payload.tradingName,
    companyType: payload.legalForm,
    mcc: payload.mcc,
    kvkNumber: payload.kvkNumber,
    ...(payload.vatNumber ? { vatNumber: payload.vatNumber } : {}),
    contactEmail: payload.contactEmail,
    ...(payload.contactPhone ? { contactPhone: payload.contactPhone } : {}),
    bankAccount: {
      iban: payload.iban,
      owner: payload.ibanOwner,
    },
    address: {
      street: payload.address.street,
      houseNumber: payload.address.houseNumber,
      ...(payload.address.houseNumberSuffix
        ? { houseNumberSuffix: payload.address.houseNumberSuffix }
        : {}),
      postalCode: payload.address.postalCode,
      city: payload.address.city,
      country: payload.address.country,
    },
    description: payload.businessDescription,
    ...(payload.websiteUrl ? { website: payload.websiteUrl } : {}),
    currency: payload.currency ?? 'EUR',
  };

  const raw = await paynlRequest<unknown>(
    getRestBase(),
    '/v2/merchants',
    'POST',
    { merchant: merchantObject },
  );

  return normaliseMerchantCreateResponse(raw);
}

function normaliseMerchantCreateResponse(raw: unknown): CreateMerchantResponse {
  // Pay.nl responses nest the record under different keys across endpoints.
  // Tolerate { merchant: {...} }, { data: {...} }, or a flat record.
  const root = raw as Record<string, unknown> | null;
  const m = (root?.merchant ?? root?.data ?? root ?? {}) as Record<string, unknown>;

  const merchantCode =
    (m.code as string | undefined) ??
    (m.merchantCode as string | undefined) ??
    (m.id as string | undefined);

  if (!merchantCode) {
    throw new PayNLError(502, raw, 'Pay.nl did not return a merchantCode');
  }

  return {
    merchantCode,
    boardingStatus: (m.boardingStatus as BoardingStatus) ?? 'REGISTERED',
    status: m.status as MerchantStatus | undefined,
    payoutStatus: m.payoutStatus as PayoutStatus | undefined,
  };
}

// ---------------------------------------------------------------------------
// 2. createLicense — POST /v2/licenses
//
// One call per natural person associated with the merchant (signees, UBOs,
// directors). Pay.nl returns a licenseCode that we store on our person row.
// ---------------------------------------------------------------------------

export interface MerchantPerson {
  /** Stable client-side id; echoed so we can map Pay.nl's licenseCode back. */
  clientRef: string;
  fullName: string;
  /** Optional split for Pay.nl variants that want first/last separately. */
  firstName?: string;
  lastName?: string;
  /** ISO date "YYYY-MM-DD". */
  dateOfBirth: string;
  /** ISO 3166-1 alpha-2, e.g. "NL". */
  nationality: string;
  email?: string;
  phone?: string;
  address: PayNLAddress;
  isSignee: boolean;
  isUbo: boolean;
  /** Required when isUbo=true. 0 < pct ≤ 100. */
  uboPercentage?: number;
}

export interface CreateLicenseResponse {
  /** The licenseCode Pay.nl assigned (stored on organization_persons.paynl_license_code). */
  licenseCode: string;
  /** If present, same as licenseCode on some responses. */
  code?: string;
}

/**
 * Register one person (signee / UBO) against the merchant. Returns the
 * license code, which becomes the target for any person-scoped document
 * upload (id_front, id_back).
 */
export async function createLicense(
  merchantCode: string,
  person: MerchantPerson,
): Promise<CreateLicenseResponse> {
  assertAllianceEnabled('createLicense');

  const personObject = {
    name: person.fullName,
    ...(person.firstName ? { firstName: person.firstName } : {}),
    ...(person.lastName ? { lastName: person.lastName } : {}),
    dateOfBirth: person.dateOfBirth,
    nationality: person.nationality,
    ...(person.email ? { email: person.email } : {}),
    ...(person.phone ? { phone: person.phone } : {}),
    address: {
      street: person.address.street,
      houseNumber: person.address.houseNumber,
      ...(person.address.houseNumberSuffix
        ? { houseNumberSuffix: person.address.houseNumberSuffix }
        : {}),
      postalCode: person.address.postalCode,
      city: person.address.city,
      country: person.address.country,
    },
    isSignee: person.isSignee,
    isUbo: person.isUbo,
    ...(person.uboPercentage !== undefined
      ? { uboPercentage: person.uboPercentage }
      : {}),
  };

  const raw = await paynlRequest<unknown>(getRestBase(), '/v2/licenses', 'POST', {
    merchantCode,
    person: personObject,
  });

  return normaliseLicenseResponse(raw);
}

function normaliseLicenseResponse(raw: unknown): CreateLicenseResponse {
  const root = raw as Record<string, unknown> | null;
  const l = (root?.license ?? root?.data ?? root ?? {}) as Record<string, unknown>;

  const code =
    (l.code as string | undefined) ??
    (l.licenseCode as string | undefined) ??
    (l.id as string | undefined);

  if (!code) {
    throw new PayNLError(502, raw, 'Pay.nl did not return a licenseCode');
  }

  return { licenseCode: code, code };
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

  const documentsRaw =
    (m.documents as unknown[] | undefined) ??
    (root?.documents as unknown[] | undefined) ??
    [];

  const documents: MerchantInfoDocument[] = documentsRaw.map((d) => {
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
