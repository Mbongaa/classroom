import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidManageTokenShape } from '@/lib/donor-manage-token';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email/email-service';
import { formatMoney } from '@/lib/email/billing-utils';
import { buildDonorFrom } from '@/lib/email/donation-utils';
import { DonorMandateAmountChangedEmail } from '@/lib/email/templates/DonorMandateAmountChangedEmail';

/**
 * GET    /api/donate/manage/[token]   → mandate + campaign + org details
 * PATCH  /api/donate/manage/[token]   → { amount } change monthly amount
 *
 * Token-authed donor self-service. Possession of the token (delivered in
 * the donor confirmation email) is the only credential. Rate-limited per
 * IP to slow brute-force enumeration of valid tokens.
 *
 * The token is matched only against PENDING and ACTIVE mandates — once a
 * mandate is CANCELLED or EXPIRED, this endpoint returns 404 so the link
 * stops working. Cancellation lives at .../cancel, sibling route.
 */

interface MandateRow {
  id: string;
  status: string;
  monthly_amount: number | null;
  donor_name: string;
  donor_email: string;
  iban_owner: string;
  paynl_mandate_id: string;
  first_debit_at: string | null;
  next_debit_at: string | null;
  created_at: string;
  campaigns: {
    id: string;
    title: string;
    organizations: { id: string; name: string; slug: string };
  };
}

// Hard caps so a compromised token can't be used to drain a donor at
// inflated amounts. Adjust if a mosque genuinely has higher-tier donors.
const MIN_MONTHLY_CENTS = 100; // €1.00
const MAX_MONTHLY_CENTS = 100_000; // €1,000.00

function ratelimitOrFail(ip: string, route: string) {
  const rl = rateLimit(`manage:${route}:${ip}`, 30, 60_000);
  if (rl.allowed) return null;
  return NextResponse.json(
    { error: 'Too many requests. Please wait a minute and try again.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
  );
}

async function loadMandate(token: string): Promise<MandateRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('mandates')
    .select(
      'id, status, monthly_amount, donor_name, donor_email, iban_owner, paynl_mandate_id, first_debit_at, next_debit_at, created_at, campaigns!inner(id, title, organizations!inner(id, name, slug))',
    )
    .eq('manage_token', token)
    .in('status', ['PENDING', 'ACTIVE'])
    .single<MandateRow>();
  return data ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isValidManageTokenShape(token)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const limited = ratelimitOrFail(getClientIp(request.headers), 'get');
  if (limited) return limited;

  const mandate = await loadMandate(token);
  if (!mandate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: mandate.status,
    donorName: mandate.donor_name,
    donorEmail: mandate.donor_email,
    ibanOwner: mandate.iban_owner,
    monthlyAmount: mandate.monthly_amount,
    paynlMandateId: mandate.paynl_mandate_id,
    firstDebitAt: mandate.first_debit_at,
    nextDebitAt: mandate.next_debit_at,
    createdAt: mandate.created_at,
    campaign: {
      id: mandate.campaigns.id,
      title: mandate.campaigns.title,
    },
    organization: {
      id: mandate.campaigns.organizations.id,
      name: mandate.campaigns.organizations.name,
      slug: mandate.campaigns.organizations.slug,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isValidManageTokenShape(token)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const limited = ratelimitOrFail(getClientIp(request.headers), 'patch');
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  if (
    typeof body.amount !== 'number' ||
    !Number.isInteger(body.amount) ||
    body.amount < MIN_MONTHLY_CENTS ||
    body.amount > MAX_MONTHLY_CENTS
  ) {
    return NextResponse.json(
      {
        error: `amount must be an integer between ${MIN_MONTHLY_CENTS} and ${MAX_MONTHLY_CENTS} cents`,
      },
      { status: 400 },
    );
  }

  const mandate = await loadMandate(token);
  if (!mandate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const previousAmount = mandate.monthly_amount;
  if (previousAmount === body.amount) {
    return NextResponse.json({ ok: true, monthlyAmount: previousAmount, unchanged: true });
  }

  const supabase = createAdminClient();
  const { error: updateError } = await supabase
    .from('mandates')
    .update({ monthly_amount: body.amount, updated_at: new Date().toISOString() })
    .eq('id', mandate.id)
    .in('status', ['PENDING', 'ACTIVE']);

  if (updateError) {
    console.error('[Donor manage] amount update failed', {
      mandateId: mandate.id,
      error: updateError.message,
    });
    return NextResponse.json({ error: 'Failed to update amount' }, { status: 500 });
  }

  // Confirmation email — donor sees that the change happened, and gets a
  // chance to react if it wasn't them.
  try {
    const orgName = mandate.campaigns.organizations.name || 'the mosque';
    await sendEmail({
      to: mandate.donor_email,
      from: buildDonorFrom(orgName),
      subject: `Your monthly donation to ${orgName} is now ${formatMoney(body.amount, 'EUR')}`,
      react: DonorMandateAmountChangedEmail({
        donorName: mandate.donor_name,
        mosqueName: orgName,
        oldAmount: formatMoney(previousAmount ?? 0, 'EUR'),
        newAmount: formatMoney(body.amount, 'EUR'),
        campaignTitle: mandate.campaigns.title || 'General donations',
      }),
      tags: [
        { name: 'type', value: 'donor_mandate_amount_changed' },
        { name: 'organization_id', value: mandate.campaigns.organizations.id },
      ],
    });
  } catch (err) {
    console.error('[Donor manage] amount-changed email threw', {
      mandateId: mandate.id,
      error: err instanceof Error ? err.message : err,
    });
  }

  return NextResponse.json({
    ok: true,
    monthlyAmount: body.amount,
    previousAmount,
  });
}
