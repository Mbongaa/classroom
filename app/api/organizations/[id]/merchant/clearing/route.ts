import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { isAllianceEnabled } from '@/lib/paynl-alliance';

// Payout (clearing) endpoint requires a v2 Alliance equivalent — pending
// research against the docs. The route remains wired for auth + validation
// so the UI contract doesn't break; the actual Pay.nl call returns 501.

/**
 * POST /api/organizations/[id]/merchant/clearing
 *
 * Schedule a SEPA payout from the merchant's Pay.nl wallet to their bank
 * account. Org admins can use this to request a withdrawal of available funds.
 *
 * Auth: org admin or superadmin.
 *
 * Guard: the organization must have a paynl_merchant_id and donations must
 * be active (meaning onboarding is complete and KYC approved).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ClearingBody {
  amount?: number; // cents; omit for "clear full balance"
  description?: string;
}

function validateBody(
  raw: unknown,
): { ok: true; body: ClearingBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const r = raw as Record<string, unknown>;

  if (r.amount !== undefined) {
    if (typeof r.amount !== 'number' || !Number.isInteger(r.amount) || r.amount <= 0) {
      return { ok: false, error: 'amount must be a positive integer (cents) if provided' };
    }
  }
  if (r.description !== undefined && typeof r.description !== 'string') {
    return { ok: false, error: 'description must be a string if provided' };
  }

  return {
    ok: true,
    body: {
      amount: r.amount as number | undefined,
      description: (r.description as string) || 'Payout to bank account',
    },
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  if (!isAllianceEnabled()) {
    return NextResponse.json(
      { error: 'Alliance payouts are not yet activated on this platform.' },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateBody(raw);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const body = validation.body;

  try {
    const supabaseAdmin = createAdminClient();
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('paynl_merchant_id, donations_active')
      .eq('id', id)
      .single();

    if (!org?.paynl_merchant_id) {
      return NextResponse.json(
        { error: 'Organization has not completed merchant onboarding.' },
        { status: 400 },
      );
    }
    if (!org.donations_active) {
      return NextResponse.json(
        { error: 'Donations are not active for this organization.' },
        { status: 400 },
      );
    }

    // TODO: v2 port — wire up the Pay.nl Alliance v2 payout endpoint once
    // its exact path/shape is confirmed (/v2/clearings or similar).
    console.warn('[Alliance] Clearing requested but v2 endpoint not wired', {
      organizationId: id,
      merchantCode: org.paynl_merchant_id,
      amountCents: body.amount ?? 'full-balance',
      description: body.description,
    });
    return NextResponse.json(
      { error: 'Clearing payouts are not yet wired to the v2 API.' },
      { status: 501 },
    );
  } catch (error) {
    console.error('[Alliance] Unexpected error in clearing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
