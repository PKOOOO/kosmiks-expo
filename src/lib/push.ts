import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '@/config/constants';
import { apiFetch, apiHeaders } from '@/lib/api';

// Written by PushNotificationRegistrar (src/app/_layout.tsx) when it registers.
export const PUSH_TOKEN_STORAGE_KEY = 'expoPushToken';

/**
 * Tell the backend to forget this device's push token. Call it BEFORE Clerk's
 * signOut(), while the user's token is still valid, so a signed-out phone stops
 * receiving the account's notifications. Best-effort and quick: it never
 * throws, and gives up after 5 s so sign-out is never blocked.
 */
export async function unregisterPushToken(getToken: () => Promise<string | null>): Promise<void> {
  try {
    const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (!pushToken) return;
    const userToken = await getToken();
    await apiFetch(
      API_ENDPOINTS.PUSH_TOKEN,
      { method: 'DELETE', headers: apiHeaders(userToken), body: JSON.stringify({ pushToken }) },
      { timeoutMs: 5000, retry: false },
    );
  } catch (error) {
    console.warn('[PUSH] Could not unregister token on sign-out:', error);
  }
}
