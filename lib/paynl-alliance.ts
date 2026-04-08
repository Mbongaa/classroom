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
 * Fields Pay.nl's KYC flow needs. The exact field names below are placeholders
 * — verify against the Alliance API docs once activation lands, then update.
 */
export interface CreateMerchantPayload {
  /** Legal business name as registered with KvK. */
  legalName: string;
  /** Trading name shown on checkout screens. */
  tradingName: string;
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
