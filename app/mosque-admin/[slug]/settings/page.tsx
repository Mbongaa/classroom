import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
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
  thankyou_animation_id: string | null;
}

export default async function MosqueSettingsPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

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
      'id, slug, name, description, city, country, contact_email, thankyou_animation_id',
    )
    .eq('slug', slug)
    .single();

  if (!organization) {
    notFound();
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

  return (
    <main>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Mosque settings
            </p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight">{organization.name}</h1>
          </div>
          <Link
            href={`/mosque-admin/${organization.slug}`}
            className="text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
          >
            ← Back to dashboard
          </Link>
        </div>

        <SettingsTabs organization={organization} />
      </div>
    </main>
  );
}
