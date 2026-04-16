import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { refundTransaction } from '@/lib/paynl';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/organizations/[id]/transactions/[transactionId]/refund
 *
 * Initiates a full or partial refund for a PAID one-time donation.
 * Calls Pay.nl's PATCH /v1/transactions/{id}/refund. The actual status
 * transition (PAID → REFUNDED) happens asynchronously when Pay.nl sends
 * the refund.completed webhook.
 *
 * Body (optional):
 *   { "amountCents": 500 }   — partial refund in cents
 *   {}  or omitted           — full refund
 *
 * Auth: org admin or superadmin.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transactionId: string }> },
) {
  const { id, transactionId } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }
  if (!UUID_RE.test(transactionId)) {
    return NextResponse.json({ error: 'Invalid transaction id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  const { data: tx, error: fetchError } = await supabaseAdmin
    .from('transactions')
    .select('id, paynl_order_id, amount, status, campaign_id, campaigns!inner(organization_id)')
    .eq('id', transactionId)
    .single();

  if (fetchError || !tx) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  const orgId = (tx.campaigns as unknown as { organization_id: string }).organization_id;
  if (orgId !== id) {
    return NextResponse.json({ error: 'Transaction does not belong to this organization' }, { status: 403 });
  }

  if (tx.status !== 'PAID') {
    return NextResponse.json(
      { error: `Cannot refund a transaction with status "${tx.status}"` },
      { status: 409 },
    );
  }

  if (!tx.paynl_order_id) {
    return NextResponse.json({ error: 'Transaction has no Pay.nl order reference' }, { status: 400 });
  }

  let amountCents: number | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.amountCents != null) {
      amountCents = Number(body.amountCents);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        return NextResponse.json({ error: 'amountCents must be a positive number' }, { status: 400 });
      }
      if (amountCents > tx.amount) {
        return NextResponse.json({ error: 'Refund amount exceeds original transaction amount' }, { status: 400 });
      }
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const result = await refundTransaction(tx.paynl_order_id, amountCents ? { amount: amountCents } : undefined);
    console.log('[Refund] Initiated', {
      transactionId,
      paynlOrderId: tx.paynl_order_id,
      amountCents: amountCents ?? 'full',
      result,
    });
    return NextResponse.json({ success: true, refund: result });
  } catch (err) {
    console.error('[Refund] Pay.nl call failed', {
      transactionId,
      paynlOrderId: tx.paynl_order_id,
      error: err instanceof Error ? err.message : err,
    });
    return NextResponse.json({ error: 'Refund request failed' }, { status: 502 });
  }
}
