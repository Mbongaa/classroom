'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useUser } from '@/lib/contexts/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { MappedOrganization } from '@/components/superadmin/mosque-map';

// Leaflet touches `window` on import, so the map must render client-only.
const MosqueMap = dynamic(() => import('@/components/superadmin/mosque-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-md" />,
});

interface OrganizationLocation {
  id: string;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  geocoded_at: string | null;
  address_street: string | null;
  address_house_number: string | null;
  address_postal_code: string | null;
  city: string | null;
  country: string | null;
  member_count: number;
  classroom_count: number;
}

interface LocationsResponse {
  organizations: OrganizationLocation[];
  totals: { total: number; withAddress: number; mapped: number };
}

interface GeocodeResponse {
  total: number;
  succeeded: number;
  failed: number;
  cappedAt: number;
}

export default function SuperadminMapPage() {
  const { profile, loading: userLoading } = useUser();
  const router = useRouter();
  const [data, setData] = useState<LocationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [lastGeocodeResult, setLastGeocodeResult] = useState<GeocodeResponse | null>(null);

  useEffect(() => {
    if (!userLoading && (!profile || !profile.is_superadmin)) {
      router.replace('/dashboard');
    }
  }, [profile, userLoading, router]);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin/organizations/locations');
      if (!res.ok) throw new Error('Failed to fetch organization locations');
      const json = (await res.json()) as LocationsResponse;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.is_superadmin) {
      fetchLocations();
    }
  }, [profile, fetchLocations]);

  const handleGeocodeMissing = useCallback(async () => {
    setGeocoding(true);
    setLastGeocodeResult(null);
    try {
      const res = await fetch('/api/superadmin/organizations/geocode', { method: 'POST' });
      if (!res.ok) throw new Error('Geocoding request failed');
      const result = (await res.json()) as GeocodeResponse;
      setLastGeocodeResult(result);
      await fetchLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeocoding(false);
    }
  }, [fetchLocations]);

  const mappedOrgs = useMemo<MappedOrganization[]>(() => {
    if (!data) return [];
    return data.organizations
      .filter(
        (o): o is OrganizationLocation & { latitude: number; longitude: number } =>
          o.latitude != null && o.longitude != null,
      )
      .map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        latitude: o.latitude,
        longitude: o.longitude,
        address_street: o.address_street,
        address_house_number: o.address_house_number,
        address_postal_code: o.address_postal_code,
        city: o.city,
        country: o.country,
        member_count: o.member_count,
        classroom_count: o.classroom_count,
      }));
  }, [data]);

  if (userLoading || !profile?.is_superadmin) {
    return null;
  }

  const totals = data?.totals;
  const missing = totals ? totals.withAddress - totals.mapped : 0;

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">
            Mosque Map
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Geographic footprint of every mosque with a registered address.
          </p>
        </div>
        <Button
          onClick={handleGeocodeMissing}
          disabled={geocoding || loading || missing === 0}
          variant="outline"
        >
          {geocoding
            ? 'Geocoding…'
            : missing > 0
              ? `Geocode ${missing} missing`
              : 'All addresses mapped'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {lastGeocodeResult && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          Geocoded {lastGeocodeResult.succeeded} of {lastGeocodeResult.total}
          {lastGeocodeResult.failed > 0 ? ` · ${lastGeocodeResult.failed} failed` : ''}
          {lastGeocodeResult.total === lastGeocodeResult.cappedAt
            ? ` · capped at ${lastGeocodeResult.cappedAt} per run, click again to continue`
            : ''}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Mapped</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-black dark:text-white">
                {totals?.mapped ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">With address</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-black dark:text-white">
                {totals?.withAddress ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total mosques</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-black dark:text-white">
                {totals?.total ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="h-[600px] p-0">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <MosqueMap mosques={mappedOrgs} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
