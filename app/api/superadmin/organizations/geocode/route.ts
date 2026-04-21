import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { geocodeAddress } from '@/lib/geocoding';

// Cap per run so we stay well under Vercel's serverless function budget.
// At Nominatim's 1 req/sec policy + 8s timeout per call, 30 rows = ~30-60s worst case.
const MAX_PER_RUN = 30;
const NOMINATIM_DELAY_MS = 1100;

export async function POST() {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  const { data: candidates, error: fetchError } = await supabaseAdmin
    .from('organizations')
    .select('id, address_street, address_house_number, address_postal_code, city, country')
    .is('latitude', null)
    .or('address_street.not.is.null,city.not.is.null,address_postal_code.not.is.null')
    .limit(MAX_PER_RUN);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const rows = candidates ?? [];
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const coords = await geocodeAddress({
      street: row.address_street,
      houseNumber: row.address_house_number,
      postalCode: row.address_postal_code,
      city: row.city,
      country: row.country,
    });

    if (coords) {
      const { error: updateError } = await supabaseAdmin
        .from('organizations')
        .update({
          latitude: coords.lat,
          longitude: coords.lng,
          geocoded_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (updateError) {
        failed += 1;
        console.error('[Geocode backfill] Update failed', row.id, updateError.message);
      } else {
        succeeded += 1;
      }
    } else {
      failed += 1;
    }

    // Respect Nominatim's 1 req/sec policy. Skip the delay after the last row.
    if (i < rows.length - 1) {
      await new Promise((r) => setTimeout(r, NOMINATIM_DELAY_MS));
    }
  }

  return NextResponse.json({
    total: rows.length,
    succeeded,
    failed,
    cappedAt: MAX_PER_RUN,
  });
}
