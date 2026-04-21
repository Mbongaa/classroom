// Thin wrapper around OpenStreetMap's Nominatim geocoder.
//
// Nominatim's acceptable-use policy requires a descriptive User-Agent and a
// maximum of 1 request per second. We rely on this being called from server
// routes that sequence calls themselves (signup fires once per new org, the
// superadmin backfill endpoint sleeps between calls).

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'BayaanClassroom/1.0 (+https://bayaan.ai)';

export interface AddressParts {
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
}

export function hasAddress(parts: AddressParts): boolean {
  return Boolean(parts.street || parts.city || parts.postalCode || parts.country);
}

function buildQuery(parts: AddressParts): string {
  const line1 = [parts.street, parts.houseNumber].filter(Boolean).join(' ').trim();
  const segments = [line1, parts.postalCode, parts.city, parts.country]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  return segments.join(', ');
}

export async function geocodeAddress(parts: AddressParts): Promise<GeocodeResult | null> {
  if (!hasAddress(parts)) return null;

  const q = buildQuery(parts);
  if (!q) return null;

  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const json = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = json[0];
    if (!first) return null;

    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}
