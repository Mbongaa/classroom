import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelMandate, PayNLError, redactPII } from '@/lib/paynl';
import { isValidManageTokenShape } from '@/lib/donor-manage-token';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email/email-service';
import { buildDonorFrom } from '@/lib/email/donation-utils';
import { DonorMandateCancelledEmail } from '@/lib/email/templates/DonorMandateCancelledEmail';

/**
 * POST /api/donate/manage/[token]/cancel
 *
 * Donor self-service cancellation. Hits Pay.nl DELETE then flips the
 * local row. Atomic-ish: if the local UPDATE fails after Pay.nl confirms,
 * we surface 502 with a retry hint (Pay.nl's DELETE is idempotent).
 *
 * Token auth only — possession of the email is the credential.
 */

interface MandateRow {
  id: string;
  status: string;
  paynl_mandate_id: string;
  donor_name: string;
  donor_email: string;
  campaigns: {
    title: string;
    organizations: { id: string; name: string };
  } | null;
  organizations: { id: string; name: string };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isValidManageTokenShape(token)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ip = getClientIp(request.headers);
  // Tighter limit on destructive endpoint.
  const rl = await rateLimit(`manage:cancel:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const supabase = createAdminClient();
  const { data: mandate } = await supabase
    .from('mandates')
    .select(
      'id, status, paynl_mandate_id, donor_name, donor_email, campaigns(title, organizations!inner(id, name)), organizations!inner(id, name)',
    )
    .eq('manage_token', token)
    .single<MandateRow>();

  if (!mandate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Idempotent: if it's already cancelled, return success without
  // touching Pay.nl again.
  if (mandate.status === 'CANCELLED' || mandate.status === 'EXPIRED') {
    return NextResponse.json({ ok: true, already: true, status: mandate.status });
  }

  // Only PENDING/ACTIVE mandates are cancellable; STORNO / unknown states
  // shouldn't be touched by a self-service flow.
  if (mandate.status !== 'PENDING' && mandate.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: `Cannot cancel a mandate in status ${mandate.status}` },
      { status: 409 },
    );
  }

  try {
    await cancelMandate(mandate.paynl_mandate_id);
  } catch (error) {
    if (error instanceof PayNLError) {
      console.error('[Donor manage] Pay.nl rejected cancellation', {
        mandateId: mandate.id,
        status: error.status,
        body: redactPII(error.body),
      });
      return NextResponse.json(
        { error: 'Payment provider rejected the cancellation.' },
        { status: 502 },
      );
    }
    console.error('[Donor manage] Unexpected error during cancel', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('mandates')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', mandate.id);

  if (updateError) {
    console.error('[Donor manage] cancel local UPDATE failed after Pay.nl success', {
      mandateId: mandate.id,
      paynlMandateId: mandate.paynl_mandate_id,
      error: updateError.message,
    });
    return NextResponse.json(
      {
        error:
          'Mandate is cancelled at Pay.nl but local record could not be ' +
          'updated. Please retry — the cancellation is permanent regardless.',
      },
      { status: 502 },
    );
  }

  console.log('[Donor manage] Mandate cancelled by donor', {
    mandateId: mandate.id,
    organizationId: mandate.organizations.id,
  });

  // Confirmation email so the donor (or whoever has the email) sees the
  // cancellation went through. Failures here don't fail the request —
  // the cancellation IS persisted.
  try {
    const orgName = mandate.organizations.name || 'the mosque';
    await sendEmail({
      to: mandate.donor_email,
      from: buildDonorFrom(orgName),
      subject: `Your recurring donation to ${orgName} has been cancelled`,
      react: DonorMandateCancelledEmail({
        donorName: mandate.donor_name,
        mosqueName: orgName,
        campaignTitle: mandate.campaigns?.title || 'Monthly membership',
      }),
      tags: [
        { name: 'type', value: 'donor_mandate_cancelled' },
        { name: 'organization_id', value: mandate.organizations.id },
      ],
    });
  } catch (err) {
    console.error('[Donor manage] cancellation email threw', {
      mandateId: mandate.id,
      error: err instanceof Error ? err.message : err,
    });
  }

  return NextResponse.json({ ok: true, status: 'CANCELLED' });
}
