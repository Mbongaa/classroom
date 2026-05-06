import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type OrganizationRole = 'admin' | 'teacher' | 'student';
export type FinanceRole = OrganizationRole | 'superadmin' | null;

export interface FinanceOrganization {
  id: string;
  slug: string;
  name: string;
}

export interface FinanceAccess {
  canAccessFinance: boolean;
  role: FinanceRole;
  isSuperadmin: boolean;
}

type AdminClient = ReturnType<typeof createAdminClient>;

export async function getFinanceAccessForOrganization(
  userId: string,
  organizationId: string,
  admin: AdminClient = createAdminClient(),
): Promise<FinanceAccess> {
  const { data: profile } = await admin
    .from('profiles')
    .select('is_superadmin')
    .eq('id', userId)
    .single();

  if (profile?.is_superadmin) {
    return {
      canAccessFinance: true,
      role: 'superadmin',
      isSuperadmin: true,
    };
  }

  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single();

  const role = (membership?.role ?? null) as FinanceRole;

  return {
    canAccessFinance: role === 'admin',
    role,
    isSuperadmin: false,
  };
}

export async function requireFinanceAccessBySlug(
  slug: string,
  redirectPath = `/mosque-admin/${slug}`,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  const supabaseAdmin = createAdminClient();
  const { data: organization } = await supabaseAdmin
    .from('organizations')
    .select<string, FinanceOrganization>('id, slug, name')
    .eq('slug', slug)
    .single();

  if (!organization) {
    notFound();
  }

  const access = await getFinanceAccessForOrganization(user.id, organization.id, supabaseAdmin);
  if (!access.canAccessFinance) {
    notFound();
  }

  return {
    user,
    supabase,
    supabaseAdmin,
    organization,
    access,
  };
}
