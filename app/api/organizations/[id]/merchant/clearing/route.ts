import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/api-auth';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/organizations/[id]/merchant/clearing
 *
 * Payout initiation is managed in Pay.nl. Bayaan exposes read-only clearing
 * visibility from /merchant/stats when the Alliance contract has reporting
 * permissions; this endpoint intentionally rejects mutation attempts.
 *
 * Auth: org admin or superadmin.
 *
 * Guard: the organization must have a paynl_merchant_id and donations must
 * be active (meaning onboarding is complete and KYC approved).
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

  const limiter = await rateLimit(`merchant:clearing:${id}:${getClientIp(request.headers)}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: 'Too many payout requests. Please wait and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limiter.retryAfterSeconds ?? 60) },
      },
    );
  }

  return NextResponse.json(
    {
      error:
        'Payout initiation is managed in Pay.nl. Use the finance dashboard settlement status for read-only payout visibility.',
    },
    { status: 410 },
  );
}
