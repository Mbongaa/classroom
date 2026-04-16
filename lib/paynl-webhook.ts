/**
 * Pay.nl webhook event parser.
 *
 * Converts the raw key/value map we receive from Pay.nl's "Exchange URL"
 * into a typed discriminated union. Downstream route handlers never deal
 * with raw strings — they switch on `event.kind` and consume typed fields.
 *
 * Pay.nl uses two wire formats depending on the API generation:
 *
 *   1. TGU (Transaction Gateway Unit) — the Connect API /v1/orders flow.
 *      Top-level `event` + `type` + `version`, nested `object[...]` keys
 *      via form-encoded bracket notation. Amounts arrive in cents.
 *
 *   2. GMS (legacy) — flat key/value pairs with `action`, `order_id`, etc.
 *      Amounts arrive as decimal-euro strings.
 *
 * This module is pure (no I/O, no DB, no network) and fully unit tested.
 */

import { parseAmountToCents } from './paynl';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WebhookEvent =
  | { kind: 'order.paid'; orderId: string; amountCents: number }
  | { kind: 'order.cancelled'; orderId: string }
  | { kind: 'order.chargeback'; orderId: string }
  | { kind: 'refund.created'; orderId: string; amountCents: number }
  | { kind: 'refund.completed'; orderId: string; amountCents: number }
  | { kind: 'refund.failed'; orderId: string; reason: string | null }
  | {
      kind: 'directdebit.pending';
      mandateCode: string;
      directDebitId: string;
      amountCents: number;
      processDate: string | null;
    }
  | { kind: 'directdebit.sent'; directDebitId: string }
  | { kind: 'directdebit.collected'; mandateCode: string | null; directDebitId: string }
  | { kind: 'directdebit.storno'; directDebitId: string }
  | { kind: 'ignored'; reason: string }
  | { kind: 'unknown'; reason: string };

/** Fields we denormalize into the audit-log row for later querying. */
export interface WebhookAuditFields {
  orderId: string | null;
  directDebitId: string | null;
  mandateCode: string | null;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parseWebhookEvent(parsed: Record<string, string>): WebhookEvent {
  if (parsed.event && parsed.type) return parseTguEvent(parsed);
  if (parsed.action) return parseGmsEvent(parsed);
  return { kind: 'unknown', reason: 'no event/type/action fields present' };
}

export function auditFieldsFor(event: WebhookEvent): WebhookAuditFields {
  switch (event.kind) {
    case 'order.paid':
    case 'order.cancelled':
    case 'order.chargeback':
    case 'refund.created':
    case 'refund.completed':
    case 'refund.failed':
      return { orderId: event.orderId, directDebitId: null, mandateCode: null };
    case 'directdebit.pending':
      return {
        orderId: null,
        directDebitId: event.directDebitId,
        mandateCode: event.mandateCode,
      };
    case 'directdebit.sent':
    case 'directdebit.storno':
      return { orderId: null, directDebitId: event.directDebitId, mandateCode: null };
    case 'directdebit.collected':
      return {
        orderId: null,
        directDebitId: event.directDebitId,
        mandateCode: event.mandateCode,
      };
    case 'ignored':
    case 'unknown':
      return { orderId: null, directDebitId: null, mandateCode: null };
  }
}

// ---------------------------------------------------------------------------
// TGU (modern) parser
// ---------------------------------------------------------------------------

function parseTguEvent(p: Record<string, string>): WebhookEvent {
  const type = p.type;
  const statusAction = (p['object[status][action]'] || '').toUpperCase();

  if (type === 'order') {
    const orderId = p['object[orderId]'];
    if (!orderId) {
      return { kind: 'unknown', reason: 'TGU order event missing object[orderId]' };
    }
    const amountCents = Number.parseInt(p['object[amount][value]'] || '0', 10);

    switch (statusAction) {
      case 'PAID':
        return { kind: 'order.paid', orderId, amountCents };
      case 'CHARGEBACK':
        return { kind: 'order.chargeback', orderId };
      case 'REFUND':
      case 'PARTIAL_REFUND':
      case 'PARTIAL REFUND':
        return { kind: 'refund.completed', orderId, amountCents };
      // Final negative states: -90/-61 CANCEL, -80 EXPIRED, -64/-63 DENIED, -60 FAILURE.
      case 'CANCEL':
      case 'CANCELLED':
      case 'CANCELED':
      case 'EXPIRED':
      case 'DENIED':
      case 'FAILURE':
        return { kind: 'order.cancelled', orderId };
      default:
        // Intermediate states like INIT/PENDING/AUTHORIZE/VERIFY/PARTLY_CAPTURED
        // arrive here and are correctly ignored — the next status_changed
        // event will tell us the final outcome.
        return { kind: 'ignored', reason: `order status=${statusAction || 'empty'}` };
    }
  }

  if (type === 'directdebit') {
    const directDebitId = p['object[id]'] || p['object[directDebitId]'] || '';
    const mandateCode = p['object[mandateCode]'] || p['object[mandate][code]'] || null;
    const amountCents = Number.parseInt(p['object[amount][value]'] || '0', 10);
    const processDate = p['object[processDate]'] || null;

    if (!directDebitId) {
      return { kind: 'unknown', reason: 'TGU directdebit event missing id' };
    }

    switch (statusAction) {
      case 'PENDING':
      case 'NEW':
        return mandateCode
          ? { kind: 'directdebit.pending', mandateCode, directDebitId, amountCents, processDate }
          : { kind: 'unknown', reason: 'TGU directdebit.pending missing mandateCode' };
      case 'SENT':
      case 'SEND':
        return { kind: 'directdebit.sent', directDebitId };
      case 'COLLECTED':
      case 'PAID':
        return { kind: 'directdebit.collected', mandateCode, directDebitId };
      case 'STORNO':
      case 'REVERSED':
      case 'CHARGEBACK':
        return { kind: 'directdebit.storno', directDebitId };
      default:
        return { kind: 'ignored', reason: `directdebit status=${statusAction || 'empty'}` };
    }
  }

  if (type === 'mandate') {
    return { kind: 'ignored', reason: `mandate status=${statusAction || 'empty'}` };
  }

  return { kind: 'unknown', reason: `TGU event with unknown type=${type}` };
}

// ---------------------------------------------------------------------------
// GMS (legacy) parser
// ---------------------------------------------------------------------------

function parseGmsEvent(p: Record<string, string>): WebhookEvent {
  const action = p.action;
  const orderId = p.order_id || p.orderId || '';
  const mandateCode = p.mandateId || p.mandate_id || '';
  const directDebitId = p.referenceId || p.reference_id || '';
  const processDate = p.processDate || p.process_date || null;

  switch (action) {
    case 'new_ppt': {
      if (!orderId) return { kind: 'unknown', reason: 'GMS new_ppt without order_id' };
      // For new_ppt the authoritative amount is in our DB (set at order-create
      // time). `0` here means "the webhook did not include a trusted amount".
      return { kind: 'order.paid', orderId, amountCents: 0 };
    }
    case 'cancel': {
      if (!orderId) return { kind: 'unknown', reason: 'GMS cancel without order_id' };
      return { kind: 'order.cancelled', orderId };
    }
    case 'incassopending': {
      if (!mandateCode || !directDebitId) {
        return { kind: 'unknown', reason: 'GMS incassopending missing ids' };
      }
      let amountCents = 0;
      if (p.amount) {
        try {
          amountCents = parseAmountToCents(p.amount);
        } catch {
          return { kind: 'unknown', reason: `GMS incassopending bad amount "${p.amount}"` };
        }
      }
      return { kind: 'directdebit.pending', mandateCode, directDebitId, amountCents, processDate };
    }
    case 'incassosend': {
      if (!directDebitId) return { kind: 'unknown', reason: 'GMS incassosend missing id' };
      return { kind: 'directdebit.sent', directDebitId };
    }
    case 'incassocollected': {
      if (!directDebitId) return { kind: 'unknown', reason: 'GMS incassocollected missing id' };
      return { kind: 'directdebit.collected', mandateCode: mandateCode || null, directDebitId };
    }
    case 'incassostorno': {
      if (!directDebitId) return { kind: 'unknown', reason: 'GMS incassostorno missing id' };
      return { kind: 'directdebit.storno', directDebitId };
    }
    case 'refund:add': {
      if (!orderId) return { kind: 'unknown', reason: 'GMS refund:add without order_id' };
      let refundCents = 0;
      if (p.amount) {
        try { refundCents = parseAmountToCents(p.amount); } catch {
          return { kind: 'unknown', reason: `GMS refund:add bad amount "${p.amount}"` };
        }
      }
      return { kind: 'refund.created', orderId, amountCents: refundCents };
    }
    case 'refund:received':
    case 'refund:send': {
      if (!orderId) return { kind: 'unknown', reason: `GMS ${action} without order_id` };
      let refundCents = 0;
      if (p.amount) {
        try { refundCents = parseAmountToCents(p.amount); } catch {
          return { kind: 'unknown', reason: `GMS ${action} bad amount "${p.amount}"` };
        }
      }
      return { kind: 'refund.completed', orderId, amountCents: refundCents };
    }
    case 'refund:storno': {
      if (!orderId) return { kind: 'unknown', reason: 'GMS refund:storno without order_id' };
      return { kind: 'refund.failed', orderId, reason: p.reason || null };
    }
    default:
      return { kind: 'unknown', reason: `GMS unknown action=${action}` };
  }
}
