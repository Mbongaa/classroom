import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  getMerchantInfo,
  isAllianceEnabled,
  listLicenses,
  PayNLAllianceNotActivatedError,
  PayNLError,
  type BoardingStatus,
  type PersonLicenseFromList,
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

async function fetchLocalDocs(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
) {
  const { data } = await supabase
    .from('organization_kyc_documents')
    .select('id, doc_type, person_id, paynl_document_code, paynl_required, translations, status, uploaded_at')
    .eq('organization_id', organizationId)
    .order('last_synced_at', { ascending: true });
  return data ?? [];
}

async function fetchLocalPersons(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
) {
  const { data } = await supabase
    .from('organization_persons')
    .select(
      'id, full_name, is_signee, is_ubo, paynl_license_code, gender, birth_country, birth_city, ubo_type, date_of_birth, nationality, email, phone, address_street, address_house_number, address_postal_code, address_city, address_country, ubo_percentage',
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

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
  existingStatus?: string,
): 'requested' | 'uploaded' | 'forwarded' | 'accepted' | 'rejected' {
  switch (remote?.toUpperCase()) {
    case 'REQUESTED':
      // Pay.nl echoes REQUESTED for documents that are uploaded but still under
      // compliance review. Never downgrade a doc that we've already submitted
      // (uploaded / forwarded) or that Pay.nl has already verified (accepted).
      if (
        existingStatus === 'accepted' ||
        existingStatus === 'forwarded' ||
        existingStatus === 'uploaded'
      ) {
        return existingStatus as 'uploaded' | 'forwarded' | 'accepted';
      }
      return 'requested';
    case 'UPLOADED':
      return 'forwarded';
    case 'VERIFIED':
    case 'APPROVED':
    case 'COMPLETED':
    case 'ACCEPTED':
      return 'accepted';
    case 'REJECTED':
      return 'rejected';
    default:
      // Preserve the existing local status for unknown Pay.nl status strings
      // rather than defaulting to 'requested' (which would undo manual fixes).
      if (existingStatus === 'accepted' || existingStatus === 'rejected') {
        return existingStatus as 'accepted' | 'rejected';
      }
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
    const [documents, persons] = await Promise.all([
      fetchLocalDocs(supabaseAdmin, id),
      fetchLocalPersons(supabaseAdmin, id),
    ]);
    return NextResponse.json({
      merchantId: null,
      serviceId: org.paynl_service_id,
      boardingStatus: null,
      kycStatus: org.kyc_status,
      donationsActive: org.donations_active,
      onboardedAt: org.onboarded_at,
      platformFeeBps: org.platform_fee_bps,
      documents,
      persons,
      source: 'local',
    });
  }

  if (!isAllianceEnabled()) {
    const [documents, persons] = await Promise.all([
      fetchLocalDocs(supabaseAdmin, id),
      fetchLocalPersons(supabaseAdmin, id),
    ]);
    return NextResponse.json({
      merchantId: org.paynl_merchant_id,
      serviceId: org.paynl_service_id,
      boardingStatus: org.paynl_boarding_status,
      kycStatus: org.kyc_status,
      donationsActive: org.donations_active,
      onboardedAt: org.onboarded_at,
      platformFeeBps: org.platform_fee_bps,
      documents,
      persons,
      source: 'local',
    });
  }

  try {
    // Fetch /info AND /v2/licenses?merchant=... in parallel. /info gives us
    // merchant-level state + document requests; /v2/licenses gives us full
    // per-license complianceData (which /info aggressively strips when the
    // license is empty — making it impossible to detect placeholders without
    // this second call).
    const [info, allLicenses] = await Promise.all([
      getMerchantInfo(org.paynl_merchant_id),
      listLicenses(org.paynl_merchant_id).catch((err) => {
        console.warn('[Alliance] listLicenses failed', {
          organizationId: id,
          merchantCode: org.paynl_merchant_id,
          error: err instanceof Error ? err.message : err,
        });
        return [] as PersonLicenseFromList[];
      }),
    ]);

    // Log raw response so we can discover the exact field names Pay.nl uses
    // for license data (birthCountry, uboType) and document statuses.
    console.log('[Alliance] getMerchantInfo raw', JSON.stringify({
      organizationId: id,
      merchantCode: org.paynl_merchant_id,
      boardingStatus: info.boardingStatus,
      // Raw document statuses from Pay.nl BEFORE our mapping.
      rawDocStatuses: info.documents.map((d) => ({ code: d.code, type: d.type, rawStatus: d.status })),
      // Full raw license objects — reveals actual field names for birthCountry / uboType.
      rawLicenses: info.raw,
    }));

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
    // Backfill the SL-XXXX-XXXX issued by Pay.nl. Without this, donation
    // routes fall back to the platform-wide PAYNL_SERVICE_ID env var and
    // money lands on Cyberlife B.V. instead of the org's own merchant.
    if (info.primaryServiceCode && info.primaryServiceCode !== org.paynl_service_id) {
      update.paynl_service_id = info.primaryServiceCode;
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

    // ---- Sync documents -------------------------------------------------------
    // Fetch existing local persons so we can map license codes to person IDs.
    const { data: personRows } = await supabaseAdmin
      .from('organization_persons')
      .select('id, paynl_license_code')
      .eq('organization_id', id);
    const localIdByLicense = new Map<string, string>();
    for (const row of personRows ?? []) {
      if (row.paynl_license_code) localIdByLicense.set(row.paynl_license_code, row.id);
    }

    const syncedAt = new Date().toISOString();

    if (info.documents.length > 0) {
      // Fetch existing doc statuses so we don't downgrade docs that are already
      // accepted (e.g. CoC that Pay.nl verified via KvK at signup).
      const { data: existingDocs } = await supabaseAdmin
        .from('organization_kyc_documents')
        .select('paynl_document_code, status')
        .eq('organization_id', id);
      const existingStatusByCode = new Map<string, string>(
        (existingDocs ?? [])
          .filter((d) => d.paynl_document_code)
          .map((d) => [d.paynl_document_code as string, d.status as string]),
      );

      const docRows = info.documents.map((d) => ({
        organization_id: id,
        person_id: d.licenseCode ? (localIdByLicense.get(d.licenseCode) ?? null) : null,
        doc_type: d.type,
        paynl_document_code: d.code,
        paynl_required: true,
        translations: d.translations ?? null,
        status: mapRemoteDocStatus(d.status, existingStatusByCode.get(d.code)),
        last_synced_at: syncedAt,
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

    // Pay.nl drops accepted/completed documents from the /info response.
    // Any doc we have locally with status requested/forwarded that is now
    // ABSENT from Pay.nl's response has been accepted on their side.
    // Only do this when Pay.nl returned at least one document (non-empty
    // response means the API is working and missing = accepted, not error).
    if (info.documents.length > 0) {
      const remoteDocCodes = info.documents.map((d) => d.code).filter(Boolean);
      if (remoteDocCodes.length > 0) {
        const { data: pendingDocs } = await supabaseAdmin
          .from('organization_kyc_documents')
          .select('id, paynl_document_code')
          .eq('organization_id', id)
          .in('status', ['requested', 'forwarded']);
        const toAccept = (pendingDocs ?? [])
          .filter((row) => row.paynl_document_code && !remoteDocCodes.includes(row.paynl_document_code))
          .map((row) => row.id);
        if (toAccept.length > 0) {
          const { error: acceptErr } = await supabaseAdmin
            .from('organization_kyc_documents')
            .update({ status: 'accepted', last_synced_at: syncedAt })
            .in('id', toAccept);
          if (acceptErr) {
            console.warn('[Alliance] Failed to mark absent docs as accepted', {
              organizationId: id,
              error: acceptErr.message,
            });
          } else {
            console.log('[Alliance] Marked absent docs as accepted', {
              organizationId: id,
              count: toAccept.length,
            });
          }
        }
      }
    }

    // ---- Sync license data fields (birthCountry, uboType) -------------------
    // These are compliance properties on the person, not file documents.
    if (info.licenses.length > 0) {
      for (const lic of info.licenses) {
        if (!lic.code) continue;
        const personId = localIdByLicense.get(lic.code);
        if (!personId) continue;
        const personUpdate: Record<string, unknown> = { updated_at: syncedAt };
        if (lic.birthCountry) personUpdate.birth_country = lic.birthCountry;
        if (lic.birthPlace) personUpdate.birth_city = lic.birthPlace;
        if (lic.uboType) personUpdate.ubo_type = lic.uboType;
        if (Object.keys(personUpdate).length > 1) {
          await supabaseAdmin
            .from('organization_persons')
            .update(personUpdate)
            .eq('id', personId);
        }
      }
    }

    const [documents, persons] = await Promise.all([
      fetchLocalDocs(supabaseAdmin, id),
      fetchLocalPersons(supabaseAdmin, id),
    ]);

    // Surface every license Pay.nl reported, including ones we don't have a
    // local row for (Pay.nl auto-creates licenses for KvK board members).
    // Prefer GET /v2/licenses output as the source of truth — it includes
    // complianceData; /info strips empties.
    const sourceLicenses: Array<{
      code: string;
      name: string | null;
      complianceData: PersonLicenseFromList['complianceData'];
      documents: typeof info.licenses[number]['documents'];
    }> = allLicenses.length > 0
      ? allLicenses.map((l) => ({
          code: l.code,
          name: l.name,
          complianceData: l.complianceData,
          documents: l.documents,
        }))
      : info.licenses.map((l) => ({
          code: l.code,
          name: l.firstName || l.lastName ? `${l.firstName ?? ''} ${l.lastName ?? ''}`.trim() : null,
          complianceData: {},
          documents: l.documents,
        }));

    const remoteLicenses = sourceLicenses.map((lic) => {
      const localId = localIdByLicense.get(lic.code) ?? null;
      const cd = lic.complianceData;
      const hasAcceptedDoc = lic.documents.some(
        (d) => d.status?.toUpperCase() === 'APPROVED' || d.status?.toUpperCase() === 'ACCEPTED',
      );
      const hasName = !!(lic.name && lic.name.trim());
      // Per-license heuristic: a license is "blank" / placeholder when it has
      // no name AND no accepted documents AND its complianceData is the
      // Pay.nl auto-default (uboPercentage=0 or unset, no DOB/nationality).
      const cdSeemsDefault =
        !cd.dateOfBirth &&
        !cd.nationality &&
        (cd.uboPercentage === undefined || cd.uboPercentage === 0);
      const isBlank = !hasName && !hasAcceptedDoc && cdSeemsDefault;

      // Field-level missing list — what Pay.nl Compliance still wants for
      // this license. We list the V2-spec-supported fields; the Pay.nl portal
      // additionally surfaces birthPlace/birthCountry/zipCode visually but
      // those map to visitAddress + (locally-stored) place of birth.
      const missing: string[] = [];
      if (!hasName) {
        missing.push('firstName', 'lastName', 'gender', 'visitAddress');
      }
      if (!cd.dateOfBirth) missing.push('dateOfBirth');
      if (!cd.nationality) missing.push('nationality');
      if (cd.ubo && cd.ubo !== 'no' && (cd.uboPercentage ?? 0) <= 0) {
        missing.push('uboPercentage');
      }
      if (cd.authorizedToSign === undefined) missing.push('authorizedToSign');
      if (!hasAcceptedDoc) missing.push('identification');
      // Place of birth + country of birth aren't in the V2 spec but the
      // Pay.nl portal asks for them — surface as hints when license is blank.
      if (isBlank) missing.push('placeOfBirth', 'birthCountry');

      return {
        code: lic.code,
        name: lic.name,
        complianceData: cd,
        documentCount: lic.documents.length,
        hasAcceptedDoc,
        isBlank,
        missingFields: missing,
        // True when we have no local row for this license — UI shows a
        // "fill in person details" CTA so admin can complete it.
        isPlaceholder: localId === null,
        localPersonId: localId,
        // Legacy name fields kept for back-compat with existing client code.
        firstName: null as string | null,
        lastName: null as string | null,
        birthCountry: null as string | null,
        birthPlace: null as string | null,
        uboType: cd.ubo ?? null,
      };
    });

    return NextResponse.json({
      merchantId: org.paynl_merchant_id,
      serviceId: info.primaryServiceCode ?? org.paynl_service_id,
      boardingStatus: info.boardingStatus ?? org.paynl_boarding_status,
      status: info.status,
      payoutStatus: info.payoutStatus,
      contractPackage: info.contractPackage,
      accountManager: info.accountManager,
      acceptedAt: info.acceptedAt,
      suspendedAt: info.suspendedAt,
      reviewedAt: info.reviewedAt,
      nextReviewDate: info.nextReviewDate,
      contractLanguage: info.contractLanguage,
      website: info.website,
      clearingAccounts: info.clearingAccounts,
      remoteLicenses,
      kycStatus: nextKyc,
      donationsActive: nextKyc === 'approved' ? true : org.donations_active,
      onboardedAt:
        nextKyc === 'approved' && !org.onboarded_at
          ? new Date().toISOString()
          : org.onboarded_at,
      platformFeeBps: org.platform_fee_bps,
      documents,
      persons,
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
      const [documents, persons] = await Promise.all([
        fetchLocalDocs(supabaseAdmin, id),
        fetchLocalPersons(supabaseAdmin, id),
      ]);
      return NextResponse.json({
        merchantId: org.paynl_merchant_id,
        serviceId: org.paynl_service_id,
        boardingStatus: org.paynl_boarding_status,
        kycStatus: org.kyc_status,
        donationsActive: org.donations_active,
        onboardedAt: org.onboarded_at,
        platformFeeBps: org.platform_fee_bps,
        documents,
        persons,
        source: 'local-fallback',
        warning: 'Could not reach Pay.nl — showing cached status.',
      });
    }
    console.error('[Alliance] Unexpected error in merchant/status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
