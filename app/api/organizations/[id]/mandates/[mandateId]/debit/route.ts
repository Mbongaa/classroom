import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { PayNLError, redactPII, triggerDirectDebit } from '@/lib/paynl';

/**
 * POST /api/organizations/[id]/mandates/[mandateId]/debit
 *
 * Triggers a subsequent direct debit against an ACTIVE flexible mandate.
 *
 * Auth: org admin (and platform superadmins via requireOrgAdmin).
 * This replaces the Phase 1 superadmin-only endpoint at
 * /api/mandates/[mandate_id]/debit — org admins can now trigger debits
 * on mandates that belong to their own organization's campaigns.
 *
 * Invariants:
 *   - mandate must be ACTIVE (first collection has been confirmed)
 *   - mandate must belong to a campaign owned by this organization
 *   - amount must be a positive integer (cents)
 *   - process_date must be a valid ISO date
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface RouteParams {
  params: Promise<{ id: string; mandateId: string }>;
}

interface DebitBody {
  amount: number;
  process_date: string;
  description?: string;
}

function validateBody(raw: unknown): { ok: true; body: DebitBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.amount !== 'number' || !Number.isInteger(r.amount) || r.amount <= 0) {
    return { ok: false, error: 'amount must be a positive integer (cents)' };
  }
  if (typeof r.process_date !== 'string' || !DATE_RE.test(r.process_date)) {
    return { ok: false, error: 'process_date must be an ISO date (YYYY-MM-DD)' };
  }
  if (r.description !== undefined && typeof r.description !== 'string') {
    return { ok: false, error: 'description must be a string if provided' };
  }

  return {
    ok: true,
    body: {
      amount: r.amount,
      process_date: r.process_date,
      description: (r.description as string) || 'Monthly donation',
    },
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id, mandateId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(mandateId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  // ---- 1. Auth: org admin or superadmin -----------------------------------
  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  // ---- 2. Parse + validate body -------------------------------------------
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

    // ---- 3. Fetch mandate with org ownership check ------------------------
    const { data: mandate, error: fetchError } = await supabaseAdmin
      .from('mandates')
      .select(
        'id, paynl_mandate_id, paynl_service_id, status, stats_extra1, stats_extra2, stats_extra3, campaign_id, organization_id',
      )
      .eq('id', mandateId)
      .single();

    if (fetchError || !mandate) {
      return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
    }

    if (mandate.organization_id !== id) {
      return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
    }

    // ---- 4. Enforce "only debit ACTIVE mandates" --------------------------
    if (mandate.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: `Mandate is not active (current status: ${mandate.status}). ` +
            'Wait for the first collection to be confirmed before triggering further debits.',
        },
        { status: 400 },
      );
    }

    // ---- 5. Build + send debit payload ------------------------------------
    const debitPayload = {
      mandate: mandate.paynl_mandate_id,
      isLastOrder: false,
      description: body.description || 'Monthly donation',
      processDate: body.process_date,
      amount: { value: body.amount, currency: 'EUR' },
      stats: {
        extra1: mandate.stats_extra1 || '',
        extra2: mandate.stats_extra2 || '',
        extra3: mandate.stats_extra3 || '',
      },
    };

    const debitResponse = await triggerDirectDebit(debitPayload);
    if (!debitResponse.id) {
      console.error('[PayNL] Debit response missing id', redactPII(debitResponse));
      return NextResponse.json(
        { error: 'Payment provider returned an unexpected response' },
        { status: 502 },
      );
    }

    // ---- 6. Persist direct_debits row -------------------------------------
    const { error: insertError } = await supabaseAdmin.from('direct_debits').insert({
      mandate_id: mandate.id,
      paynl_directdebit_id: debitResponse.id,
      paynl_order_id: debitResponse.orderId || null,
      paynl_service_id: mandate.paynl_service_id,
      amount: body.amount,
      process_date: body.process_date,
      status: 'PENDING',
    });

    if (insertError) {
      console.error('[PayNL] Failed to persist direct_debits row', {
        paynlDirectdebitId: debitResponse.id,
        error: insertError.message,
      });
    } else {
      console.log('[PayNL] Org-admin debit triggered', {
        mandateId: mandate.id,
        organizationId: id,
        paynlDirectdebitId: debitResponse.id,
      });
    }

    return NextResponse.json({
      directdebit_id: debitResponse.id,
      status: 'PENDING',
    });
  } catch (error) {
    if (error instanceof PayNLError) {
      console.error('[PayNL] Debit trigger failed', {
        status: error.status,
        body: redactPII(error.body),
      });
      return NextResponse.json(
        { error: 'Payment provider rejected the debit.' },
        { status: 502 },
      );
    }
    console.error('[PayNL] Unexpected error in org debit endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
