import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Supabase admin client BEFORE importing the route — the route
// constructs the client at handler time, but we want any call into
// `.from()` to be observed via the mock so we can assert "no DB write
// happened" on rejected webhooks.
const fromMock = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

// Pay.nl HTTP module — the webhook handler does defense-in-depth re-checks
// (fetchOrderStatus / fetchMandateStatus). We don't want those reaching
// real network in tests.
vi.mock('@/lib/paynl', async () => {
  const actual = await vi.importActual<typeof import('@/lib/paynl')>('@/lib/paynl');
  return {
    ...actual,
    fetchOrderStatus: vi.fn(async () => ({ status: 'PAID' })),
    fetchMandateStatus: vi.fn(async () => ({ code: 'IO-x', status: 'ACTIVE' })),
  };
});

// Email helpers — silent in tests. The route imports from a few sub-paths
// of @/lib/email; mock each so the Resend SDK never constructs.
vi.mock('@/lib/email/email-service', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
}));

import { GET, POST } from './route';
import { NextRequest } from 'next/server';

const VALID_SECRET = 'test-secret-correct-horse-battery';

function makeRequest(opts: {
  method: 'GET' | 'POST';
  token?: string | null;
  body?: string;
  contentType?: string;
}): NextRequest {
  const url = new URL('http://localhost/api/webhook/pay');
  if (opts.token !== null && opts.token !== undefined) {
    url.searchParams.set('token', opts.token);
  }
  const init: Record<string, unknown> = {
    method: opts.method,
  };
  if (opts.contentType) {
    init.headers = { 'content-type': opts.contentType };
  }
  if (opts.body !== undefined) {
    init.body = opts.body;
    init.duplex = 'half';
  }
  // NextRequest's RequestInit type is narrower than the global one; cast
  // through unknown to avoid the AbortSignal-nullability mismatch.
  return new NextRequest(url, init as unknown as ConstructorParameters<typeof NextRequest>[1]);
}

describe('POST/GET /api/webhook/pay — signature verification', () => {
  beforeEach(() => {
    vi.stubEnv('PAYNL_EXCHANGE_SECRET', VALID_SECRET);
    fromMock.mockReset();
    // Default: any call into .from() throws so we catch unexpected DB writes.
    fromMock.mockImplementation((table: string) => {
      throw new Error(`Unexpected DB write to ${table} in a rejected request`);
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects POST with no token but still returns 200 TRUE', async () => {
    const res = await POST(makeRequest({ method: 'POST' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('TRUE|');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects POST with wrong token but still returns 200 TRUE', async () => {
    const res = await POST(makeRequest({ method: 'POST', token: 'wrong-secret' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('TRUE|');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects GET with wrong token but still returns 200 TRUE', async () => {
    const res = await GET(makeRequest({ method: 'GET', token: 'wrong-secret' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('TRUE|');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects all requests when PAYNL_EXCHANGE_SECRET is unset (and never writes to DB)', async () => {
    vi.stubEnv('PAYNL_EXCHANGE_SECRET', '');
    const res = await POST(makeRequest({ method: 'POST', token: VALID_SECRET }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('TRUE|');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects token whose length differs from the secret (timing-safe path)', async () => {
    // Different length = timingSafeEqual short-circuit. Must still reject.
    const res = await POST(makeRequest({ method: 'POST', token: 'short' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('TRUE|');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('logs SECURITY ERROR (not warn) on rejection so log monitors can alert', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await POST(makeRequest({ method: 'POST', token: 'wrong-secret' }));
    expect(errSpy).toHaveBeenCalled();
    const firstArgs = errSpy.mock.calls[0]!;
    expect(String(firstArgs[0])).toContain('SECURITY');
    errSpy.mockRestore();
  });

  it('passes through to processExchange when token matches (DB called)', async () => {
    // For a valid token, we expect at least the audit insert into
    // exchange_events. Stub `.from('exchange_events').insert` to no-op.
    fromMock.mockImplementation((table: string) => {
      if (table === 'exchange_events') {
        return {
          insert: vi.fn(async () => ({ error: null })),
        };
      }
      // Any other table call returns a builder that no-ops to keep the
      // request from throwing. We don't assert on these — only on the
      // fact that .from was called (proving signature passed).
      const builder: Record<string, unknown> = {};
      const noop = () => builder;
      builder.update = vi.fn(() => builder);
      builder.insert = vi.fn(async () => ({ error: null, count: 0, data: [] }));
      builder.select = vi.fn(() => builder);
      builder.eq = noop;
      builder.lt = noop;
      builder.in = noop;
      builder.neq = noop;
      builder.single = vi.fn(async () => ({ data: null, error: null }));
      builder.then = (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: null, count: 0 });
      return builder;
    });

    const res = await POST(
      makeRequest({
        method: 'POST',
        token: VALID_SECRET,
        // Minimal TGU-shaped body the parser will accept (won't match
        // any real handler but processExchange should run far enough
        // to reach the audit insert).
        body:
          'event=status_changed&type=order&id=test&object[orderId]=abc' +
          '&object[status][action]=PENDING&object[amount][value]=100',
        contentType: 'application/x-www-form-urlencoded',
      }),
    );

    expect(res.status).toBe(200);
    // The audit insert into exchange_events MUST have happened.
    expect(fromMock).toHaveBeenCalledWith('exchange_events');
  });
});
