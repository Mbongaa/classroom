import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { OnboardingWizard } from './OnboardingWizard';

/**
 * /onboarding/[slug]
 *
 * Distraction-free full-screen wizard for the initial Pay.nl merchant
 * onboarding. Lives in the (onboarding) route group so it skips the
 * dashboard chrome (no sidebar, no top nav).
 *
 * Once the organization has a paynl_merchant_id the wizard redirects
 * back to the settings page — re-runs go through /settings instead.
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
  paynl_merchant_id: string | null;
  legal_form: string | null;
  mcc: string | null;
  kvk_number: string | null;
  vat_number: string | null;
  website_url: string | null;
  business_description: string | null;
  address_street: string | null;
  address_house_number: string | null;
  address_postal_code: string | null;
}

export default async function OnboardingPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/onboarding/${slug}`);
  }

  const supabaseAdmin = createAdminClient();
  const { data: organization } = await supabaseAdmin
    .from('organizations')
    .select<string, OrganizationRow>(
      'id, slug, name, description, city, country, contact_email, contact_phone, bank_iban, bank_account_holder, paynl_merchant_id, legal_form, mcc, kvk_number, vat_number, website_url, business_description, address_street, address_house_number, address_postal_code',
    )
    .eq('slug', slug)
    .single();

  if (!organization) {
    notFound();
  }

  // Already onboarded → bounce to settings (review surface).
  if (organization.paynl_merchant_id) {
    redirect(`/mosque-admin/${slug}/settings`);
  }

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

  return <OnboardingWizard organization={organization} />;
}
