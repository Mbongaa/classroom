import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';

/**
 * GET /api/organizations/[id]/mandates
 *
 * List all SEPA mandates belonging to this organization, including
 * campaignless membership mandates.
 * Returns mandates sorted by creation date (newest first), with campaign
 * title included for display.
 *
 * Auth: org admin or superadmin.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  const { data: mandates, error } = await supabaseAdmin
    .from('mandates')
    .select(
      'id, paynl_mandate_id, mandate_type, donor_name, donor_email, iban_owner, status, monthly_amount, first_debit_at, created_at, campaign_id, campaigns(id, title, slug)',
    )
    .eq('organization_id', id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[Mandates] List failed', { organizationId: id, error: error.message });
    return NextResponse.json({ error: 'Failed to fetch mandates' }, { status: 500 });
  }

  return NextResponse.json({ mandates: mandates ?? [] });
}
