import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPayNLAuthCacheForTests,
  createOrder,
  isSandboxMode,
  parseAmountToCents,
  parseExchangeBody,
  PayNLError,
  redactPII,
} from './paynl';

// Save + restore process.env between tests so mutations don't leak.
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  __resetPayNLAuthCacheForTests();
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('parseAmountToCents', () => {
  it('parses standard decimal amounts', () => {
    expect(parseAmountToCents('10.00')).toBe(1000);
    expect(parseAmountToCents('0.01')).toBe(1);
    expect(parseAmountToCents('1000.50')).toBe(100050);
    expect(parseAmountToCents('10')).toBe(1000);
  });

  it('handles floating-point edge cases via Math.round', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754; Math.round keeps us honest.
    expect(parseAmountToCents('0.30')).toBe(30);
    expect(parseAmountToCents('19.99')).toBe(1999);
  });

  it('throws on empty string', () => {
    expect(() => parseAmountToCents('')).toThrow(/invalid input/);
  });

  it('throws on non-numeric input', () => {
    expect(() => parseAmountToCents('abc')).toThrow(/malformed amount/);
  });

  it('throws on negative numbers', () => {
    expect(() => parseAmountToCents('-5.00')).toThrow(/malformed amount/);
  });

  it('throws on non-string input', () => {
    // @ts-expect-error intentional bad input
    expect(() => parseAmountToCents(10)).toThrow(/invalid input/);
    // @ts-expect-error intentional bad input
    expect(() => parseAmountToCents(null)).toThrow(/invalid input/);
  });
});

describe('parseExchangeBody', () => {
  it('parses form-encoded body', () => {
    const body = 'action=new_ppt&order_id=47601470092X44e6&amount=10.00';
    const parsed = parseExchangeBody('application/x-www-form-urlencoded', body);
    expect(parsed).toEqual({
      action: 'new_ppt',
      order_id: '47601470092X44e6',
      amount: '10.00',
    });
  });

  it('parses JSON body', () => {
    const body = JSON.stringify({
      action: 'incassocollected',
      mandateId: 'IO-1234-5678-9012',
      amount: '25.50',
    });
    const parsed = parseExchangeBody('application/json', body);
    expect(parsed).toEqual({
      action: 'incassocollected',
      mandateId: 'IO-1234-5678-9012',
      amount: '25.50',
    });
  });

  it('parses JSON body with charset suffix on content-type', () => {
    const body = JSON.stringify({ action: 'cancel' });
    const parsed = parseExchangeBody('application/json; charset=utf-8', body);
    expect(parsed.action).toBe('cancel');
  });

  it('coerces nested/null values to strings on JSON input', () => {
    const body = JSON.stringify({ action: 'new_ppt', amount: 1000, extra: null });
    const parsed = parseExchangeBody('application/json', body);
    expect(parsed.amount).toBe('1000');
    expect(parsed.extra).toBe('');
  });

  it('defaults to form-encoded when content-type is missing', () => {
    const body = 'action=cancel&order_id=ABC';
    const parsed = parseExchangeBody('', body);
    expect(parsed.action).toBe('cancel');
    expect(parsed.order_id).toBe('ABC');
  });

  it('returns empty object on invalid JSON', () => {
    const parsed = parseExchangeBody('application/json', '{not json');
    expect(parsed).toEqual({});
  });
});

describe('redactPII', () => {
  it('strips known PII fields at top level', () => {
    const input = {
      action: 'new_ppt',
      donor_name: 'Ahmed Al-Farouq',
      donor_email: 'ahmed@example.com',
      iban: 'NL69INGB0123456789',
      bic: 'INGBNL2A',
      iban_owner: 'A. Al-Farouq',
      amount: 1000,
    };
    const redacted = redactPII(input) as Record<string, unknown>;
    expect(redacted.action).toBe('new_ppt');
    expect(redacted.amount).toBe(1000);
    expect(redacted.donor_name).toBe('[REDACTED]');
    expect(redacted.donor_email).toBe('[REDACTED]');
    expect(redacted.iban).toBe('[REDACTED]');
    expect(redacted.bic).toBe('[REDACTED]');
    expect(redacted.iban_owner).toBe('[REDACTED]');
  });

  it('strips PII in nested objects', () => {
    const input = {
      customer: {
        email: 'test@example.com',
        bankAccount: { iban: 'NL69INGB0123456789', owner: 'F. Benali' },
      },
      stats: { extra1: 'campaign-uuid' },
    };
    const redacted = redactPII(input) as {
      customer: { email: string; bankAccount: unknown };
      stats: { extra1: string };
    };
    expect(redacted.customer.email).toBe('[REDACTED]');
    expect(redacted.customer.bankAccount).toBe('[REDACTED]');
    expect(redacted.stats.extra1).toBe('campaign-uuid');
  });

  it('handles arrays', () => {
    const input = [
      { donor_email: 'a@x.com', amount: 100 },
      { donor_email: 'b@x.com', amount: 200 },
    ];
    const redacted = redactPII(input) as Array<{ donor_email: string; amount: number }>;
    expect(redacted[0].donor_email).toBe('[REDACTED]');
    expect(redacted[1].donor_email).toBe('[REDACTED]');
    expect(redacted[0].amount).toBe(100);
  });

  it('passes through primitives and nullish values', () => {
    expect(redactPII(null)).toBe(null);
    expect(redactPII(undefined)).toBe(undefined);
    expect(redactPII('hello')).toBe('hello');
    expect(redactPII(42)).toBe(42);
    expect(redactPII(true)).toBe(true);
  });

  it('is case-insensitive on field names', () => {
    const input = { IBAN: 'NL69', DonorEmail: 'x@y.com' };
    const redacted = redactPII(input) as Record<string, unknown>;
    expect(redacted.IBAN).toBe('[REDACTED]');
    expect(redacted.DonorEmail).toBe('[REDACTED]');
  });
});

describe('isSandboxMode', () => {
  it('returns true when PAYNL_SANDBOX_MODE is the literal string "true"', () => {
    process.env.PAYNL_SANDBOX_MODE = 'true';
    expect(isSandboxMode()).toBe(true);
  });

  it('returns false when PAYNL_SANDBOX_MODE is unset', () => {
    delete process.env.PAYNL_SANDBOX_MODE;
    expect(isSandboxMode()).toBe(false);
  });

  it('returns false for any other string (including "1" and "TRUE")', () => {
    process.env.PAYNL_SANDBOX_MODE = '1';
    expect(isSandboxMode()).toBe(false);
    process.env.PAYNL_SANDBOX_MODE = 'TRUE';
    expect(isSandboxMode()).toBe(false);
    process.env.PAYNL_SANDBOX_MODE = 'false';
    expect(isSandboxMode()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createOrder — fetch-mocking tests
// ---------------------------------------------------------------------------

describe('createOrder', () => {
  const basePayload = {
    serviceId: 'SL-1234-5678',
    amount: { value: 1000, currency: 'EUR' },
    description: 'Test campaign donation',
    reference: 'CAMPAIGN-abcd1234',
    returnUrl: 'https://bayaanhub.nl/thank-you',
    exchangeUrl: 'https://bayaanhub.nl/api/webhook/pay?token=secret',
  };

  beforeEach(() => {
    process.env.PAYNL_TOKEN_CODE = 'AT-AAAA-BBBB';
    process.env.PAYNL_API_TOKEN = 'test-api-token-1234567890';
    process.env.PAYNL_CONNECT_BASE_URL = 'https://connect.pay.nl';
  });

  function mockFetchOk(responseBody: unknown) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  it('sends correctly encoded Basic auth header', async () => {
    const spy = mockFetchOk({ orderId: 'X1', links: { redirect: 'https://pay.nl/redirect' } });
    process.env.PAYNL_SANDBOX_MODE = 'true';

    await createOrder(basePayload);

    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0];
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    const expected = Buffer.from('AT-AAAA-BBBB:test-api-token-1234567890').toString('base64');
    expect(headers.Authorization).toBe(`Basic ${expected}`);
  });

  it('injects integration.test=true when PAYNL_SANDBOX_MODE=true', async () => {
    const spy = mockFetchOk({ orderId: 'X1', links: { redirect: 'https://pay.nl/r' } });
    process.env.PAYNL_SANDBOX_MODE = 'true';

    await createOrder(basePayload);

    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.integration).toEqual({ test: true });
  });

  it('omits integration key entirely when PAYNL_SANDBOX_MODE is not set', async () => {
    const spy = mockFetchOk({ orderId: 'X1', links: { redirect: 'https://pay.nl/r' } });
    delete process.env.PAYNL_SANDBOX_MODE;

    await createOrder({ ...basePayload, integration: { test: true } });

    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.integration).toBeUndefined();
  });

  it('truncates description to 32 characters', async () => {
    const spy = mockFetchOk({ orderId: 'X1', links: { redirect: 'https://pay.nl/r' } });
    process.env.PAYNL_SANDBOX_MODE = 'true';

    const longDescription = 'This is a very long description that exceeds 32 characters';
    await createOrder({ ...basePayload, description: longDescription });

    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.description.length).toBe(32);
    expect(body.description).toBe(longDescription.slice(0, 32));
  });

  it('throws PayNLError on non-2xx response without leaking auth header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid service id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    process.env.PAYNL_SANDBOX_MODE = 'true';

    let caught: unknown;
    try {
      await createOrder(basePayload);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(PayNLError);
    const e = caught as PayNLError;
    expect(e.status).toBe(400);
    expect(e.body).toEqual({ error: 'invalid service id' });
    // Make sure the error message never contains the base64 auth header.
    const authHeader = Buffer.from('AT-AAAA-BBBB:test-api-token-1234567890').toString('base64');
    expect(e.message).not.toContain(authHeader);
    expect(e.message).not.toContain('test-api-token');
  });

  it('throws when PAYNL_TOKEN_CODE is missing', async () => {
    delete process.env.PAYNL_TOKEN_CODE;
    await expect(createOrder(basePayload)).rejects.toThrow(
      /PAYNL_TOKEN_CODE and PAYNL_API_TOKEN/,
    );
  });
});
