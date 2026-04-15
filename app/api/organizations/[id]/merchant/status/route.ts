import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  getMerchantInfo,
  isAllianceEnabled,
  PayNLAllianceNotActivatedError,
  PayNLError,
  type BoardingStatus,
} from '@/lib/paynl-alliance';

/**
 * GET /api/organizations/[id]/merchant/status
 *
 * Refresh merchant status + document statuses from Pay.nl and sync the
 * relevant rows locally. The onboarding UI polls this endpoint.
 *
 * Lifecycle mapping (Pay.nl boardingStatus → our kyc_status):
 *   REGISTERED / ONBOARDING      → submitted (default)
 *   ACCEPTED                     → approved (donations_active=true)
 *   SUSPENDED / OFFBOARDED       → rejected  (donations_active=false)
 *
 * Auth: org admin or platform superadmin.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type KycStatus = 'pending' | 'submitted' | 'approved' | 'rejected';

function mapBoardingToKyc(
  boarding: BoardingStatus | undefined,
  current: KycStatus,
): KycStatus {
  switch (boarding) {
    case 'ACCEPTED':
      return 'approved';
    case 'SUSPENDED':
    case 'OFFBOARDED':
      return 'rejected';
    case 'REGISTERED':
    case 'ONBOARDING':
      return 'submitted';
    default:
      return current;
  }
}

function mapRemoteDocStatus(
  remote: string,
): 'requested' | 'uploaded' | 'forwarded' | 'accepted' | 'rejected' {
  switch (remote?.toUpperCase()) {
    case 'REQUESTED':
      return 'requested';
    case 'UPLOADED':
      return 'forwarded';
    case 'ACCEPTED':
      return 'accepted';
    case 'REJECTED':
      return 'rejected';
    default:
      return 'requested';
  }
}

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

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select(
      'id, name, slug, paynl_merchant_id, paynl_service_id, paynl_boarding_status, kyc_status, donations_active, onboarded_at, platform_fee_bps',
    )
    .eq('id', id)
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // No merchant yet → return local state.
  if (!org.paynl_merchant_id) {
    return NextResponse.json({
      merchantId: null,
      serviceId: org.paynl_service_id,
      boardingStatus: null,
      kycStatus: org.kyc_status,
      donationsActive: org.donations_active,
      onboardedAt: org.onboarded_at,
      platformFeeBps: org.platform_fee_bps,
      source: 'local',
    });
  }

  if (!isAllianceEnabled()) {
    return NextResponse.json({
      merchantId: org.paynl_merchant_id,
      serviceId: org.paynl_service_id,
      boardingStatus: org.paynl_boarding_status,
      kycStatus: org.kyc_status,
      donationsActive: org.donations_active,
      onboardedAt: org.onboarded_at,
      platformFeeBps: org.platform_fee_bps,
      source: 'local',
    });
  }

  try {
    const info = await getMerchantInfo(org.paynl_merchant_id);

    const nextKyc = mapBoardingToKyc(info.boardingStatus, org.kyc_status as KycStatus);

    const update: Record<string, unknown> = {};
    if (info.boardingStatus && info.boardingStatus !== org.paynl_boarding_status) {
      update.paynl_boarding_status = info.boardingStatus;
    }
    if (nextKyc !== org.kyc_status) {
      update.kyc_status = nextKyc;
    }
    if (nextKyc === 'approved' && !org.donations_active) {
      update.donations_active = true;
      update.onboarded_at = org.onboarded_at ?? new Date().toISOString();
    }
    if (nextKyc === 'rejected' && org.donations_active) {
      update.donations_active = false;
    }

    if (Object.keys(update).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('organizations')
        .update(update)
        .eq('id', id);
      if (updateError) {
        console.error('[Alliance] Failed to sync merchant status', {
          organizationId: id,
          merchantCode: org.paynl_merchant_id,
          error: updateError.message,
        });
      } else if (update.kyc_status) {
        console.log('[Alliance] KYC status synced', {
          organizationId: id,
          merchantCode: org.paynl_merchant_id,
          from: org.kyc_status,
          to: update.kyc_status,
        });
      }
    }

    // Refresh document statuses (best-effort). Map license → local person id.
    if (info.documents.length > 0) {
      const { data: personRows } = await supabaseAdmin
        .from('organization_persons')
        .select('id, paynl_license_code')
        .eq('organization_id', id);
      const localIdByLicense = new Map<string, string>();
      for (const row of personRows ?? []) {
        if (row.paynl_license_code) localIdByLicense.set(row.paynl_license_code, row.id);
      }

      const docRows = info.documents.map((d) => ({
        organization_id: id,
        person_id: d.licenseCode ? (localIdByLicense.get(d.licenseCode) ?? null) : null,
        doc_type: d.type,
        paynl_document_code: d.code,
        paynl_required: true,
        translations: d.translations ?? null,
        status: mapRemoteDocStatus(d.status),
        last_synced_at: new Date().toISOString(),
      }));
      const { error: docsError } = await supabaseAdmin
        .from('organization_kyc_documents')
        .upsert(docRows, {
          onConflict: 'organization_id,paynl_document_code',
          ignoreDuplicates: false,
        });
      if (docsError) {
        console.warn('[Alliance] Failed to sync doc statuses', {
          organizationId: id,
          error: docsError.message,
        });
      }
    }

    return NextResponse.json({
      merchantId: org.paynl_merchant_id,
      serviceId: org.paynl_service_id,
      boardingStatus: info.boardingStatus ?? org.paynl_boarding_status,
      kycStatus: nextKyc,
      donationsActive: nextKyc === 'approved' ? true : org.donations_active,
      onboardedAt:
        nextKyc === 'approved' && !org.onboarded_at
          ? new Date().toISOString()
          : org.onboarded_at,
      platformFeeBps: org.platform_fee_bps,
      source: 'paynl',
    });
  } catch (error) {
    if (error instanceof PayNLAllianceNotActivatedError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof PayNLError) {
      console.error('[Alliance] getMerchantInfo failed', {
        organizationId: id,
        merchantCode: org.paynl_merchant_id,
        status: error.status,
        body: error.body,
      });
      return NextResponse.json({
        merchantId: org.paynl_merchant_id,
        serviceId: org.paynl_service_id,
        boardingStatus: org.paynl_boarding_status,
        kycStatus: org.kyc_status,
        donationsActive: org.donations_active,
        onboardedAt: org.onboarded_at,
        platformFeeBps: org.platform_fee_bps,
        source: 'local-fallback',
        warning: 'Could not reach Pay.nl — showing cached status.',
      });
    }
    console.error('[Alliance] Unexpected error in merchant/status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
