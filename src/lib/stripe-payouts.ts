import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL } from '@/config/constants';
import { ApiError, apiFetch, apiHeaders } from '@/lib/api';

// Provider payouts through Stripe Connect. The provider's own Stripe account
// is created and filled in on Stripe's hosted pages; the backend hands the
// browser back to the app with kosmiks://stripe-return
// (cosmix-admin app/callback/stripe/*).

const RETURN_URL = 'kosmiks://stripe-return';

type GetToken = () => Promise<string | null>;

async function post<T>(getToken: GetToken, path: string): Promise<T> {
  const res = await apiFetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: apiHeaders(await getToken()) });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // Short server messages ("Finish setting up payouts first.") are shown as-is.
    throw new ApiError(ApiError.http(res.status).kind, res.status, typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`);
  }
  return body as T;
}

/**
 * Opens Stripe's onboarding in an in-app browser and waits until it returns.
 * An expired link (Stripe sends the provider to the refresh page) is reopened
 * once with a fresh link.
 */
export async function setUpStripePayouts(getToken: GetToken) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { url } = await post<{ url: string }>(getToken, '/provider/stripe/onboard');
    const result = await WebBrowser.openAuthSessionAsync(url, RETURN_URL);
    if (result.type !== 'success' || !result.url.includes('result=refresh')) return;
  }
}

/** Opens the provider's Stripe dashboard (payouts to the bank, statements). */
export async function openStripeDashboard(getToken: GetToken) {
  const { url } = await post<{ url: string }>(getToken, '/provider/stripe/dashboard');
  await WebBrowser.openBrowserAsync(url);
}

/** Asks Stripe for the account's current status (the backend stores it). */
export async function refreshStripeStatus(getToken: GetToken) {
  const res = await apiFetch(`${API_BASE_URL}/provider/stripe`, { headers: apiHeaders(await getToken()) });
  if (!res.ok) throw ApiError.http(res.status);
  return res.json() as Promise<{ connected: boolean; detailsSubmitted: boolean; payoutsEnabled: boolean; transfersActive: boolean }>;
}

export type WithdrawResult = { payoutId: string; amount: number; bookings: number; failed: number };

/** Sends the available balance to the provider's Stripe account. */
export function withdrawEarnings(getToken: GetToken) {
  return post<WithdrawResult>(getToken, '/provider/payouts/withdraw');
}
