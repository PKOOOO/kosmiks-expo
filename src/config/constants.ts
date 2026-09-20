// config/constants.ts
import { Platform } from 'react-native';

// Single source of truth for backend base URL
// Prefer environment override, otherwise default to deployed domain
const RAW_DOMAIN = process.env.EXPO_PUBLIC_PRODUCTION_DOMAIN || 'www.kosmiks.com';

// Check if the domain uses http (local dev) or https (production)
const isHttpDomain = RAW_DOMAIN.startsWith('http://');

// Clean up the domain - remove protocol if present, we'll add it ourselves
const PRODUCTION_DOMAIN = RAW_DOMAIN
  .replace(/^https?:\/\//, '')  // Remove http:// or https://
  .replace(/\/+$/, '');          // Remove trailing slashes

// Base URL used across the app
// Scheme is driven solely by the configured domain: local dev sets an explicit
// http:// value (e.g. http://192.168.1.145:3000). Never infer http from __DEV__
// alone — with no override set, that produced http://<production domain>, which
// 308-redirects to https and can drop the body or Authorization header of an
// authenticated POST in some HTTP clients.
const protocol = isHttpDomain ? 'http' : 'https';
export const API_BASE_URL = `${protocol}://${PRODUCTION_DOMAIN}/api`;

// API Endpoints
export const API_ENDPOINTS = {
  CATEGORIES: `${API_BASE_URL}/public/categories`,
  SERVICES: `${API_BASE_URL}/public/services`,
  BOOKINGS: `${API_BASE_URL}/bookings`,
  PRODUCTS: `${API_BASE_URL}/products`,
  CHECKOUT: `${API_BASE_URL}/checkout`,
  SALONS: `${API_BASE_URL}/public/saloons`,
  SALONS_MAP: `${API_BASE_URL}/public/saloons/map`,
  REVIEWS: `${API_BASE_URL}/reviews`,
  PUSH_TOKEN: `${API_BASE_URL}/user/push-token`,
} as const;

// Export other useful constants
export const CONFIG = {
  PRODUCTION_DOMAIN,
  PLATFORM: Platform.OS,
} as const;

// Mapbox public token (pk.*). Public by design — it ships inside the client
// bundle either way; sourcing it from env only stops it being hardcoded in
// source and tripping secret scanning. The secret sk.* download token must
// NEVER be added here or to eas.json.
export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

let warnedMissingMapboxToken = false;

/**
 * True when a Mapbox token is configured. Logs once when it is not, so an
 * unrendered map is traceable instead of silently emitting
 * `mapboxgl.accessToken = 'undefined'` into the WebView.
 */
export const hasMapboxToken = (): boolean => {
  if (!MAPBOX_TOKEN && !warnedMissingMapboxToken) {
    warnedMissingMapboxToken = true;
    console.error(
      '[MAP] EXPO_PUBLIC_MAPBOX_TOKEN is not set — maps cannot render. ' +
      'Set it in .env for local dev and in both env blocks of eas.json for builds.'
    );
  }
  return !!MAPBOX_TOKEN;
};

// Rendered in place of a map when no token is configured.
export const MAP_UNAVAILABLE_HTML =
  `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
  `<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;` +
  `font-family:system-ui,-apple-system,sans-serif;background:#E4D2BA;color:#423120">` +
  `<p>Karttaa ei voitu ladata.</p></body></html>`;

// Debug logging in development
if (__DEV__) {
  console.log('API Configuration:', {
    API_BASE_URL,
    PLATFORM: Platform.OS,
  });
}
