import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SettingsTabs } from './SettingsTabs';

/**
 * /mosque-admin/[slug]/settings
 *
 * Organization admin settings page. Server component that:
 *   1. Authenticates the caller and verifies they're either a member of
 *      this organization or a platform superadmin
 *   2. Fetches the organization (including settings-relevant fields)
 *   3. Renders the client-side <SettingsTabs> with the data
 *
 * The tabs themselves are interactive (animation picker, future settings)
 * so they live in a client component, but the auth + data fetch stay on
 * the server so we can rely on Supabase RLS instead of trusting the client.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  country: string;
  contact_email: string | null;
  contact_phone: string | null;
  bank_iban: string | null;
  bank_account_holder: string | null;
  thankyou_animation_id: string | null;
  paynl_merchant_id: string | null;
  paynl_service_id: string | null;
  paynl_boarding_status: 'REGISTERED' | 'ONBOARDING' | 'ACCEPTED' | 'SUSPENDED' | 'OFFBOARDED' | null;
  kyc_status: 'pending' | 'submitted' | 'approved' | 'rejected';
  donations_active: boolean;
  onboarded_at: string | null;
  platform_fee_bps: number;
  legal_form: string | null;
  mcc: string | null;
  kvk_number: string | null;
  vat_number: string | null;
  website_url: string | null;
  business_description: string | null;
  address_street: string | null;
  address_house_number: string | null;
  address_postal_code: string | null;
  preferred_locale: 'en' | 'ar' | 'nl' | 'fr' | 'de';
}

interface PersonRow {
  id: string;
  full_name: string;
  is_signee: boolean;
  is_ubo: boolean;
  paynl_license_code: string | null;
  birth_country: string | null;
  ubo_type: string | null;
}

interface KycDocumentRow {
  id: string;
  doc_type: string;
  person_id: string | null;
  paynl_document_code: string | null;
  paynl_required: boolean;
  translations: Record<string, { name?: string; description?: string }> | null;
  status: 'requested' | 'uploaded' | 'forwarded' | 'accepted' | 'rejected';
  uploaded_at: string | null;
}

export default async function MosqueSettingsPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const t = await getTranslations('mosqueAdmin.settings');
  const tRoot = await getTranslations('mosqueAdmin');

  // Require authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/mosque-admin/${slug}/settings`);
  }

  // Use the admin client to resolve the org by slug — see the dashboard page
  // for the rationale (existing organizations RLS only exposes the user's
  // primary org via profiles.organization_id).
  const supabaseAdmin = createAdminClient();
  const { data: organization } = await supabaseAdmin
    .from('organizations')
    .select<string, OrganizationRow>(
      'id, slug, name, description, city, country, contact_email, contact_phone, bank_iban, bank_account_holder, thankyou_animation_id, paynl_merchant_id, paynl_service_id, paynl_boarding_status, kyc_status, donations_active, onboarded_at, platform_fee_bps, legal_form, mcc, kvk_number, vat_number, website_url, business_description, address_street, address_house_number, address_postal_code, preferred_locale',
    )
    .eq('slug', slug)
    .single();

  if (!organization) {
    notFound();
  }

  // Load KYC persons + documents alongside the org. Empty arrays on miss —
  // these only exist after the org has been onboarded via /merchant/onboard.
  const [{ data: personsData }, { data: documentsData }] = await Promise.all([
    supabaseAdmin
      .from('organization_persons')
      .select<string, PersonRow>('id, full_name, is_signee, is_ubo, paynl_license_code, birth_country, ubo_type')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('organization_kyc_documents')
      .select<string, KycDocumentRow>(
        'id, doc_type, person_id, paynl_document_code, paynl_required, translations, status, uploaded_at',
      )
      .eq('organization_id', organization.id)
      .order('last_synced_at', { ascending: true }),
  ]);

  // Membership check (defense in depth).
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single();

  const isSuperadmin = profile?.is_superadmin === true;
  if (!isSuperadmin) {
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .single();
    if (!membership) {
      notFound();
    }
  }

  return (
    <div className="mx-auto max-w-4xl py-6">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('prefix')}
            </p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight">{organization.name}</h1>
          </div>
          <Link
            href={`/mosque-admin/${organization.slug}`}
            className="text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
          >
            {tRoot('backToDashboard')}
          </Link>
        </div>

      <SettingsTabs
        organization={{
          ...organization,
          persons: personsData ?? [],
          kyc_documents: documentsData ?? [],
        }}
      />
    </div>
  );
}
