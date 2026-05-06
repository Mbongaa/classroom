import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireFinanceAccessBySlug } from '@/lib/finance-access';
import { AppointmentsClient, type Offering, type Appointment } from './AppointmentsClient';

/**
 * /mosque-admin/[slug]/appointments
 *
 * Manage paid 1-on-1 session offerings and view upcoming bookings.
 * Same auth pattern as /products and /campaigns — server component handles
 * auth + data fetch via the admin client, then hands off to the client.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
}

const OFFERING_COLUMNS =
  'id, organization_id, slug, sheikh_name, sheikh_email, sheikh_bio, sheikh_avatar_url, price, duration_minutes, location, timezone, is_active, sort_order, created_at, updated_at';

const APPOINTMENT_COLUMNS = `
  id,
  offering_id,
  organization_id,
  scheduled_at,
  duration_minutes,
  customer_name,
  customer_email,
  customer_phone,
  notes,
  transaction_id,
  status,
  confirmed_at,
  cancelled_at,
  created_at,
  updated_at,
  offering:appointment_offerings!appointments_offering_id_fkey (
    id, sheikh_name, slug, price
  )
`;

export default async function AppointmentsPage({ params }: PageProps) {
  const { slug } = await params;
  const { supabaseAdmin } = await requireFinanceAccessBySlug(
    slug,
    `/mosque-admin/${slug}/appointments`,
  );

  const { data: organization } = await supabaseAdmin
    .from('organizations')
    .select<string, OrganizationRow>('id, slug, name')
    .eq('slug', slug)
    .single();

  if (!organization) {
    notFound();
  }

  const canManage = true;
  const canDelete = true;

  const [offeringsResult, appointmentsResult] = await Promise.all([
    supabaseAdmin
      .from('appointment_offerings')
      .select<string, Offering>(OFFERING_COLUMNS)
      .eq('organization_id', organization.id)
      .order('is_active', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('appointments')
      .select<string, Appointment>(APPOINTMENT_COLUMNS)
      .eq('organization_id', organization.id)
      .order('scheduled_at', { ascending: false })
      .limit(200),
  ]);

  return (
    <div className="mx-auto max-w-5xl py-6">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Mosque admin
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight">Appointments</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Paid 1-on-1 sessions offered by {organization.name}.
          </p>
        </div>
        <Link
          href={`/mosque-admin/${organization.slug}`}
          className="text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
        >
          ← Back to dashboard
        </Link>
      </div>

      <AppointmentsClient
        organizationId={organization.id}
        organizationSlug={organization.slug}
        initialOfferings={offeringsResult.data ?? []}
        initialAppointments={appointmentsResult.data ?? []}
        canManage={canManage}
        canDelete={canDelete}
      />
    </div>
  );
}
