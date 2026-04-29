import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { PayNLError, cancelMandate, redactPII } from '@/lib/paynl';

/**
 * POST /api/organizations/[id]/mandates/[mandateId]/cancel
 *
 * Cancels a SEPA mandate at Pay.nl and flips the local row to CANCELLED.
 *
 * Auth: org admins only (and platform superadmins via requireOrgAdmin).
 * Cancelling a mandate stops all future debits permanently — this is the
 * "pull the plug" lever for repeat-storno donors and explicit donor
 * cancellation requests.
 *
 * Defense in depth: we re-verify that the mandate belongs to a campaign
 * owned by this organization before touching Pay.nl. We then refuse if the
 * status is already CANCELLED or EXPIRED to keep the operation idempotent
 * without doubling up Pay.nl calls.
 *
 * Pay.nl errors → 502. Local DB write errors after a successful Pay.nl
 * cancel also → 502 with a clear retry hint: Pay.nl's DELETE is idempotent
 * (returns 204 even on already-cancelled mandates), so retrying the endpoint
 * safely re-attempts the local UPDATE. The reconciliation cron is the
 * fallback if the caller never retries.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteParams {
  params: Promise<{ id: string; mandateId: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id, mandateId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(mandateId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  // Org admins only — cancellation is destructive and not reversible.
  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  // Fetch the mandate WITH its campaign so we can verify org ownership.
  // The campaigns join is the only way to scope mandates to an organization
  // (mandates.campaign_id → campaigns.organization_id).
  const { data: mandate, error: fetchError } = await supabaseAdmin
    .from('mandates')
    .select(
      'id, paynl_mandate_id, status, campaign_id, campaigns!inner(id, organization_id)',
    )
    .eq('id', mandateId)
    .single();

  if (fetchError || !mandate) {
    return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
  }

  // The supabase-js typegen for embedded selects sometimes resolves to an
  // array, sometimes to an object. Normalise both shapes.
  const rawCampaigns = (mandate as unknown as { campaigns: unknown }).campaigns;
  const campaign = Array.isArray(rawCampaigns)
    ? (rawCampaigns[0] as { organization_id: string } | undefined)
    : (rawCampaigns as { organization_id: string } | null);

  if (!campaign || campaign.organization_id !== id) {
    return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
  }

  // Idempotency: if it's already cancelled/expired, treat as a no-op.
  if (mandate.status === 'CANCELLED' || mandate.status === 'EXPIRED') {
    return NextResponse.json({
      ok: true,
      already: true,
      status: mandate.status,
    });
  }

  try {
    await cancelMandate(mandate.paynl_mandate_id);
  } catch (error) {
    if (error instanceof PayNLError) {
      console.error('[PayNL] Cancel mandate failed', {
        mandateId: mandate.id,
        status: error.status,
        body: redactPII(error.body),
      });
      return NextResponse.json(
        { error: 'Payment provider rejected the cancellation.' },
        { status: 502 },
      );
    }
    console.error('[PayNL] Unexpected error cancelling mandate', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Pay.nl confirmed — flip the local row. If this update fails the local
  // state diverges from Pay.nl truth, so we surface 502 (NOT 200) and let
  // the caller retry. Pay.nl's DELETE is idempotent: a retry will short-
  // circuit on the existing CANCELLED state at Pay.nl and re-attempt the
  // DB update. Reconciliation cron is the long-term safety net.
  const { error: updateError } = await supabaseAdmin
    .from('mandates')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', mandate.id);

  if (updateError) {
    console.error('[PayNL] Mandate cancelled at Pay.nl but local UPDATE failed', {
      mandateId: mandate.id,
      paynlMandateId: mandate.paynl_mandate_id,
      error: updateError.message,
    });
    return NextResponse.json(
      {
        error:
          'Mandate is cancelled at Pay.nl but the local record could not be ' +
          'updated. Please retry — the cancellation is permanent regardless.',
      },
      { status: 502 },
    );
  }

  console.log('[PayNL] Mandate cancelled', {
    mandateId: mandate.id,
    organizationId: id,
  });

  return NextResponse.json({ ok: true, status: 'CANCELLED' });
}
