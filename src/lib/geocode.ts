import * as Location from 'expo-location';
import { MAPBOX_TOKEN } from '@/config/constants';

// Address search and pin → address lookup.
//
// Mapbox first: the OS geocoder behind expo-location is missing or unreliable
// on many Android devices (no Google Play geocoding backend), which made
// searches fail and pins show raw coordinates. expo-location stays as fallback.

const MAPBOX_GEOCODE = 'https://api.mapbox.com/search/geocode/v6';

export type GeocodeHit = { latitude: number; longitude: number; address: string };

const coordsLabel = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

async function mapboxJson(path: string, params: Record<string, string>): Promise<any | null> {
  if (!MAPBOX_TOKEN) return null;
  const query = new URLSearchParams({ ...params, access_token: MAPBOX_TOKEN }).toString();
  try {
    const res = await fetch(`${MAPBOX_GEOCODE}/${path}?${query}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Free-text address → up to `limit` matches. `near` biases results towards the current map position. */
export async function searchAddresses(
  query: string,
  { near, limit = 5 }: { near?: { latitude: number; longitude: number } | null; limit?: number } = {},
): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (!q) return [];

  const params: Record<string, string> = { q, limit: String(limit) };
  if (near) params.proximity = `${near.longitude},${near.latitude}`;
  const data = await mapboxJson('forward', params);
  const hits: GeocodeHit[] = (data?.features ?? []).flatMap((feature: any) => {
    const coords = feature?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return [];
    return [{
      latitude: coords[1],
      longitude: coords[0],
      address: feature.properties?.full_address || feature.properties?.name || q,
    }];
  });
  if (hits.length > 0) return hits;

  try {
    const results = await Location.geocodeAsync(q);
    return results.slice(0, limit).map(r => ({ latitude: r.latitude, longitude: r.longitude, address: q }));
  } catch { /* no OS geocoder */ }
  return [];
}

/** Free-text address → best match. */
export async function forwardGeocode(
  query: string,
  near?: { latitude: number; longitude: number } | null,
): Promise<GeocodeHit | null> {
  const [hit] = await searchAddresses(query, { near, limit: 1 });
  return hit ?? null;
}

/** Coordinates → readable address ("Street 1, 00100 Helsinki, Finland"). Never throws. */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const data = await mapboxJson('reverse', {
    latitude: String(latitude),
    longitude: String(longitude),
    limit: '1',
  });
  const props = data?.features?.[0]?.properties;
  const fromMapbox = props?.full_address || props?.place_formatted || props?.name;
  if (fromMapbox) return fromMapbox;

  try {
    const [r] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const line = r
      ? [
          [r.street, r.streetNumber].filter(Boolean).join(' '),
          r.postalCode,
          r.city,
          r.country,
        ].filter(Boolean).join(', ')
      : '';
    if (line) return line;
  } catch { /* no OS geocoder */ }
  return coordsLabel(latitude, longitude);
}
