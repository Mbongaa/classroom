import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from '@/lib/api-auth';
import { PayNLError, redactPII, triggerDirectDebit } from '@/lib/paynl';

/**
 * POST /api/mandates/[mandate_id]/debit
 *
 * Triggers a subsequent direct debit against an ACTIVE flexible mandate.
 *
 * Auth: requireSuperAdmin (platform superadmin only). Phase 1 does not have
 * a mosque-scoped admin role yet, so the platform superadmin is the only
 * safe gate. Phase 2 will introduce mosque-admin auth and this guard will
 * be swapped for a mosque-membership check tied to the mandate's mosque_id.
 *
 * Invariant: we refuse to debit unless mandate.status === 'ACTIVE'. This is
 * the "no second debit until the first is collected" rule from the plan.
 */

interface DebitBody {
  amount: number; // cents
  process_date: string; // ISO date
  description?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mandate_id: string }> },
) {
  // ---- 1. Auth: platform superadmin only --------------------------------
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

  // ---- 2. Parse params + body -------------------------------------------
  const { mandate_id: mandateIdParam } = await params;
  if (!mandateIdParam) {
    return NextResponse.json({ error: 'mandate_id is required' }, { status: 400 });
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
    // ---- 3. Fetch mandate -----------------------------------------------
    const supabaseAdmin = createAdminClient();
    const { data: mandate, error: mandateError } = await supabaseAdmin
      .from('mandates')
      .select(
        'id, paynl_mandate_id, paynl_service_id, status, stats_extra1, stats_extra2, stats_extra3',
      )
      .eq('id', mandateIdParam)
      .single();

    if (mandateError || !mandate) {
      return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
    }

    // ---- 4. Enforce "only debit ACTIVE mandates" ------------------------
    if (mandate.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: `Mandate is not active (current status: ${mandate.status}). Wait for the first incassocollected webhook before triggering further debits.`,
        },
        { status: 400 },
      );
    }

    // ---- 5. Build + send debit payload ----------------------------------
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

    // ---- 6. Persist direct_debits row -----------------------------------
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
      // Pay.nl accepted the debit; just return success and reconcile later.
    } else {
      console.log('[PayNL] Subsequent debit triggered', {
        mandateId: mandate.id,
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
    console.error('[PayNL] Unexpected error in /api/mandates/[id]/debit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
