/**
 * Pay.nl Alliance API client — Phase 2 scaffolding
 *
 * ⚠️ STUBBED UNTIL ALLIANCE ACTIVATION.
 *
 * The Alliance API lets Bayaan Hub act as a platform that programmatically
 * creates and manages sub-merchants (one per mosque). Access to these
 * endpoints is granted by Pay.nl only after they review a working sandbox
 * integration + business KYC. Until then, every function in this module
 * throws `PayNLAllianceNotActivatedError`.
 *
 * This file exists so the rest of Phase 2 can:
 *   - Import typed function signatures (no magic strings)
 *   - Wire up the mosque onboarding flow with clean call sites
 *   - Replace stub bodies with real fetch calls the day Pay.nl flips the
 *     switch, without touching any calling code
 *
 * Enable with PAYNL_ALLIANCE_ENABLED=true once Alliance is granted.
 *
 * Endpoint reference (TBD — verify against Pay.nl docs once activated):
 *   POST   rest.pay.nl/v1/merchants                      → createMerchant
 *   GET    rest.pay.nl/v1/merchants/{id}                 → getMerchant
 *   POST   rest.pay.nl/v1/merchants/{id}/invoices        → addInvoice
 *   POST   rest.pay.nl/v1/merchants/{id}/clearings       → addClearing
 *   GET    rest.pay.nl/v1/merchants/{id}/statistics      → getMerchantStats
 */

import { paynlRequest, PayNLError } from './paynl';

// ---------------------------------------------------------------------------
// Activation check
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
// createMerchant
// ---------------------------------------------------------------------------

/**
 * Dutch legal forms Pay.nl will accept. The exact string values Pay.nl
 * expects on the wire may differ — verify against Alliance docs when
 * activation lands. The mapping lives in one place (`LEGAL_FORM_LABELS`)
 * so a rename is one-line.
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

/**
 * A natural person attached to the merchant. Pay.nl's Merchant:Create
 * requires at least one signee, plus every UBO (≥25% ownership/control)
 * for entities that have them (VOF, BV, stichting, vereniging, coöperatie).
 * A single person may be both signee and UBO.
 */
export interface MerchantPerson {
  /** Stable client-side id; echoed back so we can match the Pay.nl id to our row. */
  clientRef: string;
  fullName: string;
  /** ISO date "YYYY-MM-DD". */
  dateOfBirth: string;
  /** ISO 3166-1 alpha-2, e.g. "NL". */
  nationality: string;
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
  /** Required when isUbo=true. 0 < pct ≤ 100. */
  uboPercentage?: number;
}

/**
 * Fields Pay.nl's Merchant:Create endpoint expects. Field names follow the
 * pattern used elsewhere in this client (camelCase). Pay.nl's wire format
 * may differ on cosmetics — the shape is what matters.
 */
export interface CreateMerchantPayload {
  /** Legal business name as registered with KvK. */
  legalName: string;
  /** Trading name shown on checkout screens. */
  tradingName: string;
  /** Legal form — drives which documents / UBO rules apply. */
  legalForm: LegalForm;
  /** Merchant Category Code (ISO 18245). Donations typically 8398. */
  mcc: string;
  /** KvK (Dutch Chamber of Commerce) number. */
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
  address: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    country: string; // ISO 3166-1 alpha-2, e.g. "NL"
  };
  /** Brief description of what the merchant sells/accepts donations for. */
  businessDescription: string;
  /** URL of the merchant's public website. */
  websiteUrl?: string;
  /**
   * Signees + UBOs. Must contain ≥1 signee. For all legal forms except
   * `eenmanszaak`, must also contain ≥1 UBO.
   */
  persons: MerchantPerson[];
}

export interface CreateMerchantResponse {
  /** Pay.nl internal merchant id (e.g. "M-XXXX-XXXX"). */
  merchantId: string;
  /** Sales location automatically created for the merchant. */
  serviceId: string; // SL-XXXX-XXXX
  /** Secret associated with the new sales location. */
  serviceSecret: string;
  /** Current KYC state reported by Pay.nl. */
  kycStatus: 'pending' | 'submitted' | 'approved' | 'rejected';
  /**
   * Per-person ids Pay.nl assigned. Matched back to our rows by clientRef.
   * Used as the target for `id_front` / `id_back` document uploads.
   */
  persons?: Array<{ clientRef: string; paynlPersonId: string }>;
}

/**
 * Register a new sub-merchant under the Bayaan Hub Alliance account.
 * Returns the Pay.nl merchant id + the SL-code for the mosque's own
 * sales location.
 */
export async function createMerchant(
  payload: CreateMerchantPayload,
): Promise<CreateMerchantResponse> {
  assertAllianceEnabled('createMerchant');
  return paynlRequest<CreateMerchantResponse>(getRestBase(), '/v1/merchants', 'POST', payload);
}

// ---------------------------------------------------------------------------
// uploadMerchantDocument — KYC file upload
// ---------------------------------------------------------------------------

export type KycDocumentType =
  | 'kvk_extract'
  | 'ubo_extract'
  | 'id_front'
  | 'id_back'
  | 'bank_statement'
  | 'power_of_attorney'
  | 'other';

export interface UploadMerchantDocumentParams {
  merchantId: string;
  docType: KycDocumentType;
  /** Required for `id_front` / `id_back`. */
  paynlPersonId?: string;
  fileName: string;
  mimeType: string;
  /** Raw bytes to upload. */
  data: Uint8Array | ArrayBuffer | Buffer;
}

export interface UploadMerchantDocumentResponse {
  documentId: string;
  status: 'received' | 'accepted' | 'rejected';
}

/**
 * Forward a single KYC document to Pay.nl. The exact endpoint path + body
 * shape (multipart vs base64) will need a small tweak once Alliance lands;
 * the shape below mirrors Pay.nl's documented document-upload convention
 * (multipart/form-data with `docType`, `personId`, and `file`).
 */
export async function uploadMerchantDocument(
  params: UploadMerchantDocumentParams,
): Promise<UploadMerchantDocumentResponse> {
  assertAllianceEnabled('uploadMerchantDocument');

  const { merchantId, docType, paynlPersonId, fileName, mimeType, data } = params;
  const form = new FormData();
  form.append('docType', docType);
  if (paynlPersonId) form.append('personId', paynlPersonId);
  const blob = new Blob([toArrayBuffer(data)], { type: mimeType });
  form.append('file', blob, fileName);

  // Use a bare fetch here: paynlRequest serialises JSON, which breaks
  // multipart. Auth still goes through the same basic-auth helper.
  const url = `${getRestBase()}/v1/merchants/${encodeURIComponent(merchantId)}/documents`;
  const tokenCode = process.env.PAYNL_TOKEN_CODE;
  const apiToken = process.env.PAYNL_API_TOKEN;
  if (!tokenCode || !apiToken) {
    throw new PayNLError(
      500,
      'Pay.nl credentials missing (PAYNL_TOKEN_CODE / PAYNL_API_TOKEN).',
    );
  }
  const basic = Buffer.from(`${tokenCode}:${apiToken}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new PayNLError(res.status, `Pay.nl document upload failed: ${text || res.statusText}`);
  }
  return (await res.json()) as UploadMerchantDocumentResponse;
}

function toArrayBuffer(input: Uint8Array | ArrayBuffer | Buffer): ArrayBuffer {
  if (input instanceof ArrayBuffer) return input;
  // Buffer and Uint8Array both have .byteOffset/.byteLength on a shared buffer.
  const view = input as Uint8Array;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// getMerchant
// ---------------------------------------------------------------------------

export interface MerchantResponse {
  merchantId: string;
  serviceId: string;
  legalName: string;
  tradingName: string;
  kycStatus: 'pending' | 'submitted' | 'approved' | 'rejected';
  isActive: boolean;
  walletBalance?: {
    value: number; // cents
    currency: string;
  };
}

export async function getMerchant(merchantId: string): Promise<MerchantResponse> {
  assertAllianceEnabled('getMerchant');
  return paynlRequest<MerchantResponse>(
    getRestBase(),
    `/v1/merchants/${encodeURIComponent(merchantId)}`,
    'GET',
  );
}

// ---------------------------------------------------------------------------
// addInvoice — platform fee deduction
// ---------------------------------------------------------------------------

export interface AddInvoicePayload {
  /** Amount to deduct from the merchant's wallet, in cents. */
  amount: number;
  currency: string;
  /** Description shown on the merchant's invoice. */
  description: string;
  /** Optional reference (e.g. the transaction id this fee relates to). */
  reference?: string;
}

export interface AddInvoiceResponse {
  invoiceId: string;
  status: 'created' | 'posted' | 'failed';
}

/**
 * Deduct the platform fee (e.g. 2% of a successful donation) from the
 * mosque's Pay.nl wallet. Called after `order.paid` webhook processing.
 */
export async function addInvoice(
  merchantId: string,
  payload: AddInvoicePayload,
): Promise<AddInvoiceResponse> {
  assertAllianceEnabled('addInvoice');
  return paynlRequest<AddInvoiceResponse>(
    getRestBase(),
    `/v1/merchants/${encodeURIComponent(merchantId)}/invoices`,
    'POST',
    payload,
  );
}

// ---------------------------------------------------------------------------
// addClearing — trigger payout to mosque bank account
// ---------------------------------------------------------------------------

export interface AddClearingPayload {
  /** Amount to clear in cents; omit for "clear full balance". */
  amount?: number;
  currency: string;
  /** Human-readable note shown on the SEPA transfer. */
  description: string;
}

export interface AddClearingResponse {
  clearingId: string;
  status: 'scheduled' | 'processing' | 'completed' | 'failed';
  /** Expected settlement date. */
  processDate?: string; // ISO date
}

/**
 * Schedule a SEPA payout from the merchant's wallet to their bank account.
 * Can be manual (mosque admin presses "withdraw") or automated (cron).
 */
export async function addClearing(
  merchantId: string,
  payload: AddClearingPayload,
): Promise<AddClearingResponse> {
  assertAllianceEnabled('addClearing');
  return paynlRequest<AddClearingResponse>(
    getRestBase(),
    `/v1/merchants/${encodeURIComponent(merchantId)}/clearings`,
    'POST',
    payload,
  );
}

// ---------------------------------------------------------------------------
// getMerchantStats — reporting
// ---------------------------------------------------------------------------

export interface MerchantStatsQuery {
  from: string; // ISO date
  to: string; // ISO date
  groupBy?: 'day' | 'week' | 'month';
}

export interface MerchantStatsResponse {
  merchantId: string;
  totalDonations: number; // cents
  totalPlatformFees: number; // cents
  transactionCount: number;
  buckets: Array<{
    period: string;
    amount: number;
    count: number;
  }>;
}

export async function getMerchantStats(
  merchantId: string,
  query: MerchantStatsQuery,
): Promise<MerchantStatsResponse> {
  assertAllianceEnabled('getMerchantStats');
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
    ...(query.groupBy ? { groupBy: query.groupBy } : {}),
  });
  return paynlRequest<MerchantStatsResponse>(
    getRestBase(),
    `/v1/merchants/${encodeURIComponent(merchantId)}/statistics?${params.toString()}`,
    'GET',
  );
}

// ---------------------------------------------------------------------------
// Error-path export — re-export so callers have a single import surface.
// ---------------------------------------------------------------------------

export { PayNLError };
