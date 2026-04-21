'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icons are broken when loaded via webpack/Next because
// the CSS-referenced icon URLs don't resolve. Rebind them to the CDN copies so
// markers render without a separate asset pipeline.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface MappedOrganization {
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  address_street: string | null;
  address_house_number: string | null;
  address_postal_code: string | null;
  city: string | null;
  country: string | null;
  member_count: number;
  classroom_count: number;
}

interface MosqueMapProps {
  mosques: MappedOrganization[];
}

function formatAddress(m: MappedOrganization): string {
  const line1 = [m.address_street, m.address_house_number].filter(Boolean).join(' ');
  const line2 = [m.address_postal_code, m.city].filter(Boolean).join(' ');
  return [line1, line2, m.country].filter(Boolean).join(', ');
}

function FitBounds({ mosques }: { mosques: MappedOrganization[] }) {
  const map = useMap();

  useEffect(() => {
    if (mosques.length === 0) return;
    if (mosques.length === 1) {
      map.setView([mosques[0].latitude, mosques[0].longitude], 12);
      return;
    }
    const bounds = L.latLngBounds(mosques.map((m) => [m.latitude, m.longitude]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [mosques, map]);

  return null;
}

export default function MosqueMap({ mosques }: MosqueMapProps) {
  // Default view: roughly centered on the Netherlands where most mosques are today.
  const defaultCenter = useMemo<[number, number]>(() => [52.1, 5.3], []);

  return (
    <MapContainer
      center={defaultCenter}
      zoom={7}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds mosques={mosques} />
      {mosques.map((m) => (
        <Marker key={m.id} position={[m.latitude, m.longitude]}>
          <Popup>
            <div className="space-y-1">
              <div className="font-semibold">{m.name}</div>
              <div className="text-xs text-slate-600">{formatAddress(m)}</div>
              <div className="text-xs text-slate-600">
                {m.member_count} member{m.member_count === 1 ? '' : 's'} ·{' '}
                {m.classroom_count} classroom{m.classroom_count === 1 ? '' : 's'}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
