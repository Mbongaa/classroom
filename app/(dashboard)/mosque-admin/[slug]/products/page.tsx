import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProductsClient, type Product } from './ProductsClient';

/**
 * /mosque-admin/[slug]/products
 *
 * Product management page for a single organization. Same auth pattern as
 * the campaigns page: server component handles auth + data fetch via the
 * admin client, then hands off to a client component for the interactive
 * list + create/edit dialogs.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
}

const PRODUCT_COLUMNS =
  'id, organization_id, slug, title, description, price, category, image_url, stock, is_active, sort_order, created_at, updated_at';

export default async function ProductsPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const t = await getTranslations('mosqueAdmin.products');
  const tRoot = await getTranslations('mosqueAdmin');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/mosque-admin/${slug}/products`);
  }

  const supabaseAdmin = createAdminClient();
  const { data: organization } = await supabaseAdmin
    .from('organizations')
    .select<string, OrganizationRow>('id, slug, name')
    .eq('slug', slug)
    .single();

  if (!organization) {
    notFound();
  }

  // Membership + role check.
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single();
  const isSuperadmin = profile?.is_superadmin === true;

  let userRole: 'admin' | 'teacher' | 'student' | 'superadmin' | null = isSuperadmin
    ? 'superadmin'
    : null;

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
    userRole = membership.role as 'admin' | 'teacher' | 'student';
  }

  const canManage = userRole === 'admin' || userRole === 'teacher' || userRole === 'superadmin';
  const canDelete = userRole === 'admin' || userRole === 'superadmin';

  const { data: products } = await supabaseAdmin
    .from('products')
    .select<string, Product>(PRODUCT_COLUMNS)
    .eq('organization_id', organization.id)
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-5xl py-6">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {tRoot('prefix')}
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {t('pageSubtitle', { name: organization.name })}
          </p>
        </div>
        <Link
          href={`/mosque-admin/${organization.slug}`}
          className="text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
        >
          {tRoot('backToDashboard')}
        </Link>
      </div>

      <ProductsClient
        organizationId={organization.id}
        organizationSlug={organization.slug}
        initialProducts={products ?? []}
        canManage={canManage}
        canDelete={canDelete}
      />
    </div>
  );
}
