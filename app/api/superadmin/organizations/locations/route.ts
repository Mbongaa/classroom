import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  const { data: organizations, error } = await supabaseAdmin
    .from('organizations')
    .select(
      `
      id,
      name,
      slug,
      subscription_tier,
      subscription_status,
      created_at,
      latitude,
      longitude,
      geocoded_at,
      address_street,
      address_house_number,
      address_postal_code,
      city,
      country,
      members:organization_members(count),
      classrooms:classrooms(count)
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orgs = (organizations ?? []).map((org: any) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    subscription_tier: org.subscription_tier,
    subscription_status: org.subscription_status,
    created_at: org.created_at,
    latitude: org.latitude,
    longitude: org.longitude,
    geocoded_at: org.geocoded_at,
    address_street: org.address_street,
    address_house_number: org.address_house_number,
    address_postal_code: org.address_postal_code,
    city: org.city,
    country: org.country,
    member_count: org.members?.[0]?.count ?? 0,
    classroom_count: org.classrooms?.[0]?.count ?? 0,
  }));

  const total = orgs.length;
  const withAddress = orgs.filter(
    (o) => o.address_street || o.city || o.address_postal_code || o.country,
  ).length;
  const mapped = orgs.filter((o) => o.latitude != null && o.longitude != null).length;

  return NextResponse.json({
    organizations: orgs,
    totals: { total, withAddress, mapped },
  });
}
