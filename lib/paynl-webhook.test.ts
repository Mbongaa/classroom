import { describe, it, expect } from 'vitest';
import { auditFieldsFor, parseWebhookEvent } from './paynl-webhook';

// Real-world TGU payload captured from a Pay.nl sandbox order.
// Trimmed to the keys our parser actually reads.
function tguOrderPayload(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    event: 'status_changed',
    type: 'order',
    version: '1',
    id: '69d5527e-4411-8ba4-1ac8-4797242511bb',
    'object[type]': 'sale',
    'object[orderId]': '44117730080X11bb',
    'object[status][action]': 'PAID',
    'object[status][code]': '100',
    'object[amount][value]': '1000',
    'object[amount][currency]': 'EUR',
    ...overrides,
  };
}

function tguDirectDebitPayload(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    event: 'status_changed',
    type: 'directdebit',
    version: '1',
    id: 'some-uuid',
    'object[id]': 'IL-1234-5678-9012',
    'object[mandateCode]': 'IO-1111-2222-3333',
    'object[status][action]': 'PENDING',
    'object[amount][value]': '2500',
    'object[amount][currency]': 'EUR',
    'object[processDate]': '2026-05-01',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TGU — order events
// ---------------------------------------------------------------------------

describe('parseWebhookEvent — TGU order events', () => {
  it('parses a PAID order', () => {
    const event = parseWebhookEvent(tguOrderPayload());
    expect(event).toEqual({
      kind: 'order.paid',
      orderId: '44117730080X11bb',
      amountCents: 1000,
    });
  });

  it.each([
    ['CANCEL'],
    ['CANCELLED'],
    ['CANCELED'],
    ['EXPIRED'],
    ['DENIED'],
    ['FAILURE'],
    ['REFUND'],
    ['PARTIAL_REFUND'],
    ['PARTIAL REFUND'],
    ['CHARGEBACK'],
  ])('parses a %s order as cancelled', (status) => {
    const event = parseWebhookEvent(tguOrderPayload({ 'object[status][action]': status }));
    expect(event).toEqual({
      kind: 'order.cancelled',
      orderId: '44117730080X11bb',
    });
  });

  it.each([['PENDING'], ['AUTHORIZED'], ['PROCESSING']])(
    'ignores intermediate order status %s',
    (status) => {
      const event = parseWebhookEvent(tguOrderPayload({ 'object[status][action]': status }));
      expect(event.kind).toBe('ignored');
    },
  );

  it('returns unknown when object[orderId] is missing', () => {
    const p = tguOrderPayload();
    delete p['object[orderId]'];
    const event = parseWebhookEvent(p);
    expect(event.kind).toBe('unknown');
  });

  it('reads amountCents directly from object[amount][value] — already in cents', () => {
    // TGU format sends cents, so 12345 → 12345 (no decimal conversion).
    const event = parseWebhookEvent(tguOrderPayload({ 'object[amount][value]': '12345' }));
    expect(event).toMatchObject({ kind: 'order.paid', amountCents: 12345 });
  });

  it('defaults amountCents to 0 when object[amount][value] is missing', () => {
    const p = tguOrderPayload();
    delete p['object[amount][value]'];
    const event = parseWebhookEvent(p);
    expect(event).toMatchObject({ kind: 'order.paid', amountCents: 0 });
  });

  it('is case-insensitive on status action', () => {
    const event = parseWebhookEvent(tguOrderPayload({ 'object[status][action]': 'paid' }));
    expect(event.kind).toBe('order.paid');
  });
});

// ---------------------------------------------------------------------------
// TGU — directdebit events
// ---------------------------------------------------------------------------

describe('parseWebhookEvent — TGU directdebit events', () => {
  it('parses PENDING directdebit with mandate code', () => {
    const event = parseWebhookEvent(tguDirectDebitPayload());
    expect(event).toEqual({
      kind: 'directdebit.pending',
      mandateCode: 'IO-1111-2222-3333',
      directDebitId: 'IL-1234-5678-9012',
      amountCents: 2500,
      processDate: '2026-05-01',
    });
  });

  it('falls back to unknown when PENDING directdebit has no mandate code', () => {
    const p = tguDirectDebitPayload();
    delete p['object[mandateCode]'];
    const event = parseWebhookEvent(p);
    expect(event.kind).toBe('unknown');
  });

  it.each([['SENT'], ['SEND']])('parses %s as directdebit.sent', (status) => {
    const event = parseWebhookEvent(
      tguDirectDebitPayload({ 'object[status][action]': status }),
    );
    expect(event).toEqual({
      kind: 'directdebit.sent',
      directDebitId: 'IL-1234-5678-9012',
    });
  });

  it.each([['COLLECTED'], ['PAID']])('parses %s as directdebit.collected', (status) => {
    const event = parseWebhookEvent(
      tguDirectDebitPayload({ 'object[status][action]': status }),
    );
    expect(event).toMatchObject({
      kind: 'directdebit.collected',
      directDebitId: 'IL-1234-5678-9012',
      mandateCode: 'IO-1111-2222-3333',
    });
  });

  it.each([['STORNO'], ['REVERSED'], ['CHARGEBACK']])(
    'parses %s as directdebit.storno',
    (status) => {
      const event = parseWebhookEvent(
        tguDirectDebitPayload({ 'object[status][action]': status }),
      );
      expect(event).toEqual({
        kind: 'directdebit.storno',
        directDebitId: 'IL-1234-5678-9012',
      });
    },
  );

  it('accepts alternative mandate key object[mandate][code]', () => {
    const p = tguDirectDebitPayload();
    delete p['object[mandateCode]'];
    p['object[mandate][code]'] = 'IO-AAAA-BBBB-CCCC';
    const event = parseWebhookEvent(p);
    expect(event).toMatchObject({
      kind: 'directdebit.pending',
      mandateCode: 'IO-AAAA-BBBB-CCCC',
    });
  });

  it('returns unknown when directdebit id is missing', () => {
    const p = tguDirectDebitPayload();
    delete p['object[id]'];
    const event = parseWebhookEvent(p);
    expect(event.kind).toBe('unknown');
  });

  it('ignores unknown intermediate directdebit statuses', () => {
    const event = parseWebhookEvent(
      tguDirectDebitPayload({ 'object[status][action]': 'PROCESSING' }),
    );
    expect(event.kind).toBe('ignored');
  });
});

// ---------------------------------------------------------------------------
// TGU — mandate events (log-only for Phase 1)
// ---------------------------------------------------------------------------

describe('parseWebhookEvent — TGU mandate events', () => {
  it('ignores mandate events (we activate via directdebit.collected)', () => {
    const event = parseWebhookEvent({
      event: 'status_changed',
      type: 'mandate',
      'object[code]': 'IO-1111-2222-3333',
      'object[status][action]': 'ACTIVE',
    });
    expect(event.kind).toBe('ignored');
  });

  it('returns unknown for unknown TGU top-level types', () => {
    const event = parseWebhookEvent({
      event: 'status_changed',
      type: 'voucher',
    });
    expect(event.kind).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// GMS (legacy) — order events
// ---------------------------------------------------------------------------

describe('parseWebhookEvent — GMS legacy order events', () => {
  it('parses new_ppt into order.paid', () => {
    const event = parseWebhookEvent({
      action: 'new_ppt',
      order_id: '12345X6789',
      amount: '10.00',
    });
    expect(event).toEqual({
      kind: 'order.paid',
      orderId: '12345X6789',
      // new_ppt ignores the webhook amount — authoritative value comes from
      // the DB row created at order-create time.
      amountCents: 0,
    });
  });

  it('parses cancel into order.cancelled', () => {
    const event = parseWebhookEvent({ action: 'cancel', order_id: '12345X6789' });
    expect(event).toEqual({ kind: 'order.cancelled', orderId: '12345X6789' });
  });

  it('accepts orderId as a fallback key name', () => {
    const event = parseWebhookEvent({ action: 'new_ppt', orderId: '12345X6789' });
    expect(event).toMatchObject({ kind: 'order.paid', orderId: '12345X6789' });
  });

  it('returns unknown when new_ppt has no order id', () => {
    const event = parseWebhookEvent({ action: 'new_ppt' });
    expect(event.kind).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// GMS — directdebit events
// ---------------------------------------------------------------------------

describe('parseWebhookEvent — GMS legacy directdebit events', () => {
  it('parses incassopending with decimal-euro amount into cents', () => {
    const event = parseWebhookEvent({
      action: 'incassopending',
      mandateId: 'IO-1111-2222-3333',
      referenceId: 'IL-1234-5678-9012',
      amount: '25.50',
      processDate: '2026-05-01',
    });
    expect(event).toEqual({
      kind: 'directdebit.pending',
      mandateCode: 'IO-1111-2222-3333',
      directDebitId: 'IL-1234-5678-9012',
      amountCents: 2550,
      processDate: '2026-05-01',
    });
  });

  it('returns unknown when incassopending has malformed amount', () => {
    const event = parseWebhookEvent({
      action: 'incassopending',
      mandateId: 'IO-1111-2222-3333',
      referenceId: 'IL-1234-5678-9012',
      amount: 'not-a-number',
    });
    expect(event.kind).toBe('unknown');
  });

  it('parses incassosend', () => {
    const event = parseWebhookEvent({
      action: 'incassosend',
      referenceId: 'IL-1234-5678-9012',
    });
    expect(event).toEqual({
      kind: 'directdebit.sent',
      directDebitId: 'IL-1234-5678-9012',
    });
  });

  it('parses incassocollected, mandate code optional', () => {
    const withMandate = parseWebhookEvent({
      action: 'incassocollected',
      mandateId: 'IO-1111-2222-3333',
      referenceId: 'IL-1234-5678-9012',
    });
    expect(withMandate).toEqual({
      kind: 'directdebit.collected',
      mandateCode: 'IO-1111-2222-3333',
      directDebitId: 'IL-1234-5678-9012',
    });

    const noMandate = parseWebhookEvent({
      action: 'incassocollected',
      referenceId: 'IL-1234-5678-9012',
    });
    expect(noMandate).toMatchObject({
      kind: 'directdebit.collected',
      mandateCode: null,
    });
  });

  it('parses incassostorno', () => {
    const event = parseWebhookEvent({
      action: 'incassostorno',
      referenceId: 'IL-1234-5678-9012',
    });
    expect(event).toEqual({
      kind: 'directdebit.storno',
      directDebitId: 'IL-1234-5678-9012',
    });
  });

  it('returns unknown for an unrecognized action', () => {
    const event = parseWebhookEvent({ action: 'some_new_action' });
    expect(event.kind).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Empty / validation pings
// ---------------------------------------------------------------------------

describe('parseWebhookEvent — empty payloads', () => {
  it('returns unknown for a completely empty payload', () => {
    const event = parseWebhookEvent({});
    expect(event).toEqual({
      kind: 'unknown',
      reason: 'no event/type/action fields present',
    });
  });

  it('returns unknown for only noise fields', () => {
    const event = parseWebhookEvent({ foo: 'bar', baz: 'qux' });
    expect(event.kind).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// auditFieldsFor
// ---------------------------------------------------------------------------

describe('auditFieldsFor', () => {
  it('extracts order id for order.paid', () => {
    expect(
      auditFieldsFor({ kind: 'order.paid', orderId: 'X1', amountCents: 100 }),
    ).toEqual({ orderId: 'X1', directDebitId: null, mandateCode: null });
  });

  it('extracts order id for order.cancelled', () => {
    expect(auditFieldsFor({ kind: 'order.cancelled', orderId: 'X1' })).toEqual({
      orderId: 'X1',
      directDebitId: null,
      mandateCode: null,
    });
  });

  it('extracts mandate + debit ids for directdebit.pending', () => {
    expect(
      auditFieldsFor({
        kind: 'directdebit.pending',
        mandateCode: 'IO-1',
        directDebitId: 'IL-1',
        amountCents: 100,
        processDate: null,
      }),
    ).toEqual({ orderId: null, directDebitId: 'IL-1', mandateCode: 'IO-1' });
  });

  it('returns all-null for ignored/unknown events', () => {
    expect(auditFieldsFor({ kind: 'ignored', reason: 'test' })).toEqual({
      orderId: null,
      directDebitId: null,
      mandateCode: null,
    });
    expect(auditFieldsFor({ kind: 'unknown', reason: 'test' })).toEqual({
      orderId: null,
      directDebitId: null,
      mandateCode: null,
    });
  });
});
