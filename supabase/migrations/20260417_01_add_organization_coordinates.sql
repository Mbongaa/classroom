-- Adds geocoded coordinates to organizations so the superadmin map can plot mosques
-- without re-geocoding addresses on every page load. Nominatim (OpenStreetMap) is
-- used to populate these at signup and whenever address fields change.

alter table public.organizations
  add column latitude double precision,
  add column longitude double precision,
  add column geocoded_at timestamptz;

comment on column public.organizations.latitude is 'Geocoded latitude from address fields; nullable. Updated when address changes.';
comment on column public.organizations.longitude is 'Geocoded longitude from address fields; nullable. Updated when address changes.';
comment on column public.organizations.geocoded_at is 'Timestamp of the last successful geocoding; null if never geocoded or address cleared.';
