import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  submitForReview,
  getMerchantInfo,
  isAllianceEnabled,
  PayNLAllianceNotActivatedError,
  PayNLError,
} from '@/lib/paynl-alliance';
import { redactPII } from '@/lib/paynl';
import { assertPayNLProductionConfig } from '@/lib/paynl-production';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/organizations/[id]/merchant/submit-for-review
 *
 * Flips the merchant from REGISTERED/ONBOARDING into Pay.nl's Compliance
 * review queue. Pay.nl then returns ACCEPTED / SUSPENDED asynchronously;
 * the UI can refresh status by polling /info (or via webhook later).
 *
 * Prerequisites:
 *   - org has paynl_merchant_id
 *   - every row flagged `paynl_required = true` has a file attached
 *     (status ∈ {uploaded, forwarded, accepted}, NOT 'requested')
 *
 * Auth: org admin or platform superadmin.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const limiter = await rateLimit(
    `merchant:submit:${id}:${auth.user?.id ?? getClientIp(request.headers)}`,
    {
      limit: 5,
      windowMs: 60_000,
    },
  );
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: 'Too many review submissions. Please wait and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limiter.retryAfterSeconds ?? 60) },
      },
    );
  }

  if (!isAllianceEnabled()) {
    return NextResponse.json(
      { error: 'Pay.nl Alliance is not yet activated on this platform.' },
      { status: 503 },
    );
  }
  const productionConfigError = assertPayNLProductionConfig();
  if (productionConfigError) {
    return NextResponse.json({ error: productionConfigError }, { status: 503 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, paynl_merchant_id, paynl_boarding_status')
    .eq('id', id)
    .single();
  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }
  if (!org.paynl_merchant_id) {
    return NextResponse.json(
      { error: 'Organization has not been onboarded yet.' },
      { status: 409 },
    );
  }
  if (org.paynl_boarding_status === 'ACCEPTED') {
    return NextResponse.json(
      { error: 'Merchant is already accepted.' },
      { status: 409 },
    );
  }

  // Guard: all required documents must be attached.
  const { data: requiredDocs, error: docsError } = await supabaseAdmin
    .from('organization_kyc_documents')
    .select('id, paynl_document_code, status')
    .eq('organization_id', id)
    .eq('paynl_required', true);

  if (docsError) {
    console.error('[Alliance] Failed to check required docs before submit', {
      organizationId: id,
      error: docsError.message,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const outstanding = (requiredDocs ?? []).filter((d) => d.status === 'requested');
  if (outstanding.length > 0) {
    return NextResponse.json(
      {
        error:
          `${outstanding.length} required document${outstanding.length === 1 ? '' : 's'} ` +
          'still outstanding.',
        outstandingCodes: outstanding.map((d) => d.paynl_document_code),
      },
      { status: 409 },
    );
  }

  // ---- Call Pay.nl ---------------------------------------------------------
  try {
    const result = await submitForReview(org.paynl_merchant_id);

    // kyc_status stays 'submitted' — the CHECK constraint only allows
    // pending|submitted|approved|rejected, and 'submitted' correctly
    // describes "sent to Pay.nl, awaiting decision".
    await supabaseAdmin
      .from('organizations')
      .update({
        paynl_boarding_status: result.boardingStatus,
        kyc_status: 'submitted',
      })
      .eq('id', id);

    // Opportunistic refresh — Pay.nl may already have richer info back
    // (e.g., updated document statuses). Swallow errors; non-fatal.
    try {
      const info = await getMerchantInfo(org.paynl_merchant_id);
      if (info.boardingStatus) {
        await supabaseAdmin
          .from('organizations')
          .update({ paynl_boarding_status: info.boardingStatus })
          .eq('id', id);
      }
    } catch (err) {
      console.warn('[Alliance] Post-submit info refresh failed', {
        organizationId: id,
        merchantCode: org.paynl_merchant_id,
        error: err instanceof Error ? err.message : err,
      });
    }

    console.log('[Alliance] Merchant submitted for review', {
      organizationId: id,
      merchantCode: org.paynl_merchant_id,
      boardingStatus: result.boardingStatus,
    });

    return NextResponse.json({
      merchantCode: org.paynl_merchant_id,
      boardingStatus: result.boardingStatus,
      kycStatus: 'submitted',
    });
  } catch (error) {
    if (error instanceof PayNLAllianceNotActivatedError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof PayNLError) {
      // Pay.nl returns 422 with COMPANY_ALREADY_MARKED_AS_READY when the
      // merchant was already submitted in a previous session. This is not an
      // error — the first submission succeeded. Treat as idempotent success.
      const body = error.body;
      const detail =
        body && typeof body === 'object' && 'detail' in body &&
        typeof (body as { detail: unknown }).detail === 'string'
          ? (body as { detail: string }).detail
          : '';
      if (detail.includes('COMPANY_ALREADY_MARKED_AS_READY')) {
        console.log('[Alliance] Merchant already submitted for review (idempotent)', {
          organizationId: id,
          merchantCode: org.paynl_merchant_id,
        });

        await supabaseAdmin
          .from('organizations')
          .update({ kyc_status: 'submitted' })
          .eq('id', id);

        // Refresh from Pay.nl to get the current boarding status.
        let boardingStatus = org.paynl_boarding_status;
        try {
          const info = await getMerchantInfo(org.paynl_merchant_id);
          if (info.boardingStatus) {
            boardingStatus = info.boardingStatus;
            await supabaseAdmin
              .from('organizations')
              .update({ paynl_boarding_status: info.boardingStatus })
              .eq('id', id);
          }
        } catch {
          // non-fatal
        }

        return NextResponse.json({
          merchantCode: org.paynl_merchant_id,
          boardingStatus,
          kycStatus: 'submitted',
          note: 'Already submitted — status confirmed.',
        });
      }

      console.error('[Alliance] submitForReview failed', {
        organizationId: id,
        merchantCode: org.paynl_merchant_id,
        status: error.status,
        body: redactPII(error.body),
      });
      return NextResponse.json(
        {
          error:
            'Pay.nl rejected the review submission. Please check document statuses and try again.',
        },
        { status: 502 },
      );
    }
    console.error('[Alliance] Unexpected error in submit-for-review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
