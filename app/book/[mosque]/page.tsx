import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BookingClient, type BookingOffering } from './BookingClient';

/**
 * /book/[mosque]
 *
 * Public mobile-first booking page. Shows the organization's active
 * appointment offerings (sheikhs), lets the user pick one, choose a date and
 * time from live availability, enter contact details, and pay via Pay.nl.
 *
 * No authentication. Organization resolution uses the anon client + public
 * RLS policy (must be `donations_active = true`, same as the donate page).
 */

interface PageProps {
  params: Promise<{ mosque: string }>;
}

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country: string;
}

interface OfferingRow {
  id: string;
  slug: string;
  sheikh_name: string;
  sheikh_bio: string | null;
  sheikh_avatar_url: string | null;
  price: number;
  duration_minutes: number;
  location: string | null;
  timezone: string;
}

export default async function PublicBookingPage({ params }: PageProps) {
  const { mosque: slug } = await params;

  const supabase = await createClient();

  const { data: organization } = await supabase
    .from('organizations')
    .select<string, OrganizationRow>('id, slug, name, city, country')
    .eq('slug', slug)
    .eq('donations_active', true)
    .single();

  if (!organization) notFound();

  const supabaseAdmin = createAdminClient();
  const { data: offerings } = await supabaseAdmin
    .from('appointment_offerings')
    .select<string, OfferingRow>(
      'id, slug, sheikh_name, sheikh_bio, sheikh_avatar_url, price, duration_minutes, location, timezone',
    )
    .eq('organization_id', organization.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  const list: BookingOffering[] = (offerings ?? []).map((o) => ({
    id: o.id,
    slug: o.slug,
    sheikh_name: o.sheikh_name,
    sheikh_bio: o.sheikh_bio,
    sheikh_avatar_url: o.sheikh_avatar_url,
    price: o.price,
    duration_minutes: o.duration_minutes,
    location: o.location,
    timezone: o.timezone,
  }));

  return (
    <BookingClient
      orgSlug={organization.slug}
      orgName={organization.name}
      orgLocation={[organization.city, organization.country].filter(Boolean).join(', ')}
      offerings={list}
    />
  );
}
