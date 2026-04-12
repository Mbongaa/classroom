/**
 * Pay.nl API client facade — Bayaan Hub Phase 1
 *
 * Phase 1 targets a single Pay.nl sales location (sandbox) before Alliance
 * sub-merchant rights are granted. When Alliance activates, the only change
 * is swapping `serviceId` values per mosque — the transport layer here stays
 * the same.
 *
 * Two Pay.nl base URLs:
 *   - https://connect.pay.nl   TGU: orders (one-time payments)
 *   - https://rest.pay.nl      GMS: mandates, direct debits, management
 *
 * Auth is Basic: base64(`${TOKEN_CODE}:${API_TOKEN}`).
 *
 * Mirror pattern: lib/stripe.ts (lazy env read + typed helpers).
 */

// ---------------------------------------------------------------------------
// Lazy auth (mirrors lib/stripe.ts getStripe pattern)
// ---------------------------------------------------------------------------

let cachedAuthHeader: string | null = null;

/**
 * Returns the `Basic <base64>` header value for Pay.nl requests.
 * Lazy: reads env on first call so build-time static analysis doesn't blow up
 * when the env is incomplete (e.g., during `next build` on a preview branch).
 */
export function getPayNLAuth(): string {
  if (cachedAuthHeader) return cachedAuthHeader;

  const tokenCode = process.env.PAYNL_TOKEN_CODE;
  const apiToken = process.env.PAYNL_API_TOKEN;

  if (!tokenCode || !apiToken) {
    throw new Error('PAYNL_TOKEN_CODE and PAYNL_API_TOKEN must be set');
  }

  const encoded = Buffer.from(`${tokenCode}:${apiToken}`).toString('base64');
  cachedAuthHeader = `Basic ${encoded}`;
  return cachedAuthHeader;
}

/**
 * Test-only reset for the cached auth header. Never called from app code.
 * Exported so Vitest can flip env between test cases.
 */
export function __resetPayNLAuthCacheForTests(): void {
  cachedAuthHeader = null;
}

// ---------------------------------------------------------------------------
// Sandbox mode
// ---------------------------------------------------------------------------

/**
 * Sandbox flag — explicit env var, not derived from NODE_ENV.
 * Rationale: Vercel preview deploys set NODE_ENV=production, which would
 * silently turn sandbox OFF on preview branches. `PAYNL_SANDBOX_MODE=true`
 * keeps the toggle unambiguous and overridable per environment.
 */
export function isSandboxMode(): boolean {
  return process.env.PAYNL_SANDBOX_MODE === 'true';
}

/**
 * Safety belt: emits a loud WARN whenever we're running in sandbox mode on
 * the production host. Prevents accidentally shipping test:true orders live.
 */
function assertSandboxSafety(): void {
  if (!isSandboxMode()) return;
  if (process.env.NODE_ENV !== 'production') return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  if (siteUrl.includes('bayaanhub.nl')) {
    console.warn(
      '[PayNL] ⚠️  SANDBOX MODE is ACTIVE on production host (bayaanhub.nl). ' +
        'Every Order:Create call will inject integration.test=true. ' +
        'Set PAYNL_SANDBOX_MODE=false to go live.',
    );
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PayNLError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message || `Pay.nl request failed with status ${status}`);
    this.name = 'PayNLError';
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// Generic transport
// ---------------------------------------------------------------------------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Low-level Pay.nl transport. Adds Basic Auth, JSON content-type, parses JSON
 * on success, throws PayNLError on non-2xx.
 *
 * Never leaks the Authorization header into error messages.
 */
export async function paynlRequest<T>(
  baseUrl: string,
  path: string,
  method: HttpMethod,
  body?: unknown,
): Promise<T> {
  assertSandboxSafety();

  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: getPayNLAuth(),
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Pay.nl should always return JSON; fall through to error handling.
      parsed = { raw: text };
    }
  }

  if (!response.ok) {
    throw new PayNLError(
      response.status,
      parsed,
      `Pay.nl ${method} ${path} failed: ${response.status}`,
    );
  }

  return parsed as T;
}

function getConnectBase(): string {
  return process.env.PAYNL_CONNECT_BASE_URL || 'https://connect.pay.nl';
}

function getRestBase(): string {
  return process.env.PAYNL_REST_BASE_URL || 'https://rest.pay.nl';
}

// ---------------------------------------------------------------------------
// Types — Order (connect.pay.nl/v1/orders)
// ---------------------------------------------------------------------------

export interface OrderAmount {
  value: number; // cents
  currency: string;
}

export interface OrderCustomer {
  firstName?: string;
  lastName?: string;
  email?: string;
  locale?: string;
  ipAddress?: string;
}

export interface OrderStats {
  extra1?: string;
  extra2?: string;
  extra3?: string;
  info?: string;
}

export interface OrderPaymentMethod {
  /** Pay.nl payment method ID (e.g. 10 = iDEAL, 706 = Visa, 436 = Card). */
  id: number;
  input?: {
    /** iDEAL issuer/bank ID — skips Pay.nl's checkout and goes straight to the bank. */
    issuerId?: string;
  };
}

export interface OrderCreatePayload {
  serviceId: string;
  amount: OrderAmount;
  description: string;
  reference: string;
  returnUrl: string;
  exchangeUrl: string;
  paymentMethod?: OrderPaymentMethod;
  customer?: OrderCustomer;
  stats?: OrderStats;
  integration?: { test: boolean };
}

export interface OrderResponse {
  orderId: string;
  links: {
    redirect: string;
    status?: string;
  };
  status?: {
    code: number;
    action?: string;
  };
}

// ---------------------------------------------------------------------------
// Types — Mandate (rest.pay.nl/v2/directdebits/mandates)
// ---------------------------------------------------------------------------

export type MandateType = 'SINGLE' | 'RECURRING' | 'FLEXIBLE';

export interface MandateBankAccount {
  iban: string;
  bic?: string;
  owner: string;
}

export interface MandateCustomer {
  ipAddress: string;
  email?: string;
  bankAccount: MandateBankAccount;
}

export interface MandateCreatePayload {
  serviceId: string;
  reference: string;
  description: string;
  processDate: string; // ISO date
  type: MandateType;
  customer: MandateCustomer;
  amount: OrderAmount;
  stats?: OrderStats;
}

export interface MandateResponse {
  code: string; // IO-XXXX-XXXX-XXXX
  status?: string;
}

// ---------------------------------------------------------------------------
// Types — Direct debit (rest.pay.nl/v2/directdebits)
// ---------------------------------------------------------------------------

export interface DirectDebitPayload {
  mandate: string; // IO-XXXX-XXXX-XXXX
  isLastOrder: boolean;
  description: string;
  processDate: string;
  amount: OrderAmount;
  stats?: OrderStats;
}

export interface DirectDebitResponse {
  id: string; // IL-XXXX-XXXX-XXXX
  orderId?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------

/** Max length for `description` — hard-enforced bank-statement limit. */
const DESCRIPTION_MAX_LENGTH = 32;

/**
 * POST /v1/orders on connect.pay.nl. Creates a one-time hosted checkout.
 *
 * Auto-injects `integration.test=true` when PAYNL_SANDBOX_MODE=true, and
 * always truncates `description` to ≤32 chars (bank statement hard limit).
 */
export async function createOrder(payload: OrderCreatePayload): Promise<OrderResponse> {
  const sanitized: OrderCreatePayload = {
    ...payload,
    description: payload.description.slice(0, DESCRIPTION_MAX_LENGTH),
  };

  if (isSandboxMode()) {
    sanitized.integration = { test: true };
  } else {
    // Ensure we never send test:true in production by accident.
    delete sanitized.integration;
  }

  return paynlRequest<OrderResponse>(getConnectBase(), '/v1/orders', 'POST', sanitized);
}

/**
 * POST /v2/directdebits/mandates on rest.pay.nl. Creates a SEPA mandate.
 */
export async function createMandate(payload: MandateCreatePayload): Promise<MandateResponse> {
  const sanitized: MandateCreatePayload = {
    ...payload,
    description: payload.description.slice(0, DESCRIPTION_MAX_LENGTH),
  };
  return paynlRequest<MandateResponse>(
    getRestBase(),
    '/v2/directdebits/mandates',
    'POST',
    sanitized,
  );
}

/**
 * POST /v2/directdebits on rest.pay.nl. Triggers a subsequent debit on an
 * existing active mandate. Only call after mandate.status === 'ACTIVE'.
 */
export async function triggerDirectDebit(
  payload: DirectDebitPayload,
): Promise<DirectDebitResponse> {
  const sanitized: DirectDebitPayload = {
    ...payload,
    description: payload.description.slice(0, DESCRIPTION_MAX_LENGTH),
  };
  return paynlRequest<DirectDebitResponse>(getRestBase(), '/v2/directdebits', 'POST', sanitized);
}

/**
 * GET /v1/orders/{orderId} — used for webhook re-verification (defense in depth).
 */
export async function fetchOrderStatus(orderId: string): Promise<OrderResponse> {
  return paynlRequest<OrderResponse>(
    getConnectBase(),
    `/v1/orders/${encodeURIComponent(orderId)}`,
    'GET',
  );
}

/**
 * GET /v2/directdebits/mandates/{code} — used for webhook re-verification.
 */
export async function fetchMandateStatus(mandateCode: string): Promise<MandateResponse> {
  return paynlRequest<MandateResponse>(
    getRestBase(),
    `/v2/directdebits/mandates/${encodeURIComponent(mandateCode)}`,
    'GET',
  );
}

/**
 * DELETE /v2/directdebits/mandates/{code} — cancels a SEPA mandate at Pay.nl.
 *
 * Pay.nl's cancel endpoint is idempotent and returns 204 No Content on
 * success. Once cancelled, no further debits can be triggered against the
 * mandate. Local DB row should be flipped to status='CANCELLED' after a
 * successful response.
 *
 * Use cases:
 *   - donor calls the mosque and asks to cancel
 *   - admin sees repeated stornos (insufficient funds) and pulls the plug
 */
export async function cancelMandate(mandateCode: string): Promise<void> {
  await paynlRequest<unknown>(
    getRestBase(),
    `/v2/directdebits/mandates/${encodeURIComponent(mandateCode)}`,
    'DELETE',
  );
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable)
// ---------------------------------------------------------------------------

/**
 * Parses a decimal-euro string (e.g. "10.50") into integer cents.
 * Pay.nl's exchange webhooks send direct-debit amounts as decimal strings,
 * while our DB stores cents. Order-create webhooks should have their webhook
 * `amount` field ignored — DB already has authoritative cents.
 *
 * Throws on NaN, negative, or non-finite inputs.
 */
export function parseAmountToCents(amountString: string): number {
  if (typeof amountString !== 'string' || amountString.length === 0) {
    throw new Error(`parseAmountToCents: invalid input ${JSON.stringify(amountString)}`);
  }
  const n = parseFloat(amountString);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`parseAmountToCents: malformed amount ${JSON.stringify(amountString)}`);
  }
  return Math.round(n * 100);
}

/**
 * Parses a Pay.nl exchange webhook body into a flat record. Pay.nl sends
 * either `application/x-www-form-urlencoded` (legacy default) or
 * `application/json` depending on exchange config — handle both.
 */
export function parseExchangeBody(
  contentType: string,
  text: string,
): Record<string, string> {
  const ct = (contentType || '').toLowerCase();

  if (ct.includes('application/json')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          out[k] = v == null ? '' : String(v);
        }
        return out;
      }
      return {};
    } catch {
      return {};
    }
  }

  // Default: form-encoded key/value pairs.
  return Object.fromEntries(new URLSearchParams(text));
}

/** Fields that must never appear in logs or error payloads. */
const PII_FIELDS = new Set([
  'iban',
  'bic',
  'iban_owner',
  'ibanowner',
  'donor_email',
  'donoremail',
  'email',
  'donor_name',
  'donorname',
  'firstname',
  'lastname',
  'owner',
  'bankaccount',
]);

/**
 * Recursively strips PII from an object. Used before logging anything that
 * might contain donor data. Replaces redacted values with the string
 * `"[REDACTED]"` so shape is preserved.
 */
export function redactPII(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(redactPII);
  if (typeof input !== 'object') return input;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (PII_FIELDS.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redactPII(value);
    }
  }
  return out;
}
