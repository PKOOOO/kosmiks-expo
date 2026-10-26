import { useEffect, useRef, useState } from 'react';
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

// How long a state must last before the app treats the device as offline.
// No network at all (Wi-Fi and mobile data both off) is reliable, so react
// fast. "Connected but the probe failed" also happens for a few seconds every
// time Android hands over from mobile data to a Wi-Fi network that isn't
// routing yet; the probe re-runs every 5 s, so wait past one re-check before
// believing it.
const NO_NETWORK_DELAY_MS = 1500;
const UNREACHABLE_DELAY_MS = 8000;

/**
 * True when the device has no usable internet connection.
 *
 * `isInternetReachable` is null until NetInfo's first reachability probe
 * finishes, so null is treated as "online" — otherwise every app start would
 * flash the offline banner. Going back online is reported immediately.
 */
export function useIsOffline(): boolean {
  const { isConnected, isInternetReachable } = useNetInfo();
  const noNetwork = isConnected === false;
  const unreachable = !noNetwork && isInternetReachable === false;
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (!noNetwork && !unreachable) {
      setIsOffline(false);
      return;
    }
    const timer = setTimeout(
      () => setIsOffline(true),
      noNetwork ? NO_NETWORK_DELAY_MS : UNREACHABLE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [noNetwork, unreachable]);

  return isOffline;
}

/**
 * One-off check, for code outside React (e.g. before starting a payment).
 * Only "no network at all" counts: a failed reachability probe can be a
 * passing Wi-Fi handover, and a request that then fails still gets friendly
 * error copy (and nothing is charged).
 */
export async function isOfflineNow(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === false;
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
