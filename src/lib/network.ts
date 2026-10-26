import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo, { useNetInfo } from '@react-native-community/netinfo';

// Must run before anything reads NetInfo (this module is imported by the root
// layout via OfflineBanner).
//
// By default Android reports `isInternetReachable` from the OS's "validated"
// network flag. On some devices (seen on Samsung) that flag stays false long
// after airplane mode is turned off, so the app stayed stuck "offline" even
// though requests worked. The JS probe re-checks every 5 s while unreachable
// (60 s while reachable) and clears reliably on both platforms.
NetInfo.configure({
  useNativeReachability: false,
  reachabilityShortTimeout: 5 * 1000,
});

// Re-check right away when the app returns to the foreground, instead of
// waiting for the next probe.
AppState.addEventListener('change', (state) => {
  if (state === 'active') void NetInfo.refresh();
});

/**
 * True when the device has no usable internet connection.
 *
 * `isInternetReachable` is null until NetInfo's first reachability probe
 * finishes, so null is treated as "online" — otherwise every app start would
 * flash the offline banner.
 */
export function useIsOffline(): boolean {
  const { isConnected, isInternetReachable } = useNetInfo();
  return isConnected === false || isInternetReachable === false;
}

/** One-off check, for code outside React (e.g. before starting a payment). */
export async function isOfflineNow(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === false || state.isInternetReachable === false;
}

/** Calls `callback` each time the device goes from offline back to online. */
export function useOnReconnect(callback: () => void) {
  const isOffline = useIsOffline();
  const wasOffline = useRef(isOffline);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (wasOffline.current && !isOffline) {
      callbackRef.current();
    }
    wasOffline.current = isOffline;
  }, [isOffline]);
}
