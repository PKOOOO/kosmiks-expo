import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/**
 * One app-wide "are we offline?" status, shared by every screen.
 *
 * NetInfo's change events can't be relied on: on our build (RN 0.88, new
 * architecture) they often don't reach JS while the app is in the
 * foreground, so the offline banner only updated after leaving and
 * re-opening the app. Events are still used when they arrive, but the state
 * is also polled with NetInfo.refresh() while the app is active: every 3 s
 * while offline (to notice the connection coming back) and every 15 s while
 * online.
 */

// Must run before anything reads NetInfo (this module is imported by the root
// layout via OfflineBanner).
//
// By default Android reports `isInternetReachable` from the OS's "validated"
// network flag. On some devices (seen on Samsung) that flag stays false long
// after airplane mode is turned off, so the app stayed stuck "offline" even
// though requests worked. The JS probe is reliable on both platforms.
NetInfo.configure({
  useNativeReachability: false,
  reachabilityShortTimeout: 5 * 1000,
  reachabilityRequestTimeout: 4 * 1000,
});

// How long a state must last before the app treats the device as offline.
// No network at all (Wi-Fi and mobile data both off) is reliable, so react
// fast. "Connected but the probe failed" also happens for a few seconds every
// time Android hands over from mobile data to a Wi-Fi network that isn't
// routing yet, so wait past a couple of re-checks before believing it.
const NO_NETWORK_DELAY_MS = 1500;
const UNREACHABLE_DELAY_MS = 8000;
const POLL_OFFLINE_MS = 3000;
const POLL_ONLINE_MS = 15000;

let noNetwork = false;
let unreachable = false;
let offline = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function setOffline(value: boolean) {
  if (offline === value) return;
  offline = value;
  listeners.forEach((listener) => listener());
}

function apply(state: NetInfoState) {
  const nextNoNetwork = state.isConnected === false;
  // null = first probe not finished yet: treat as online (no banner flash at start).
  const nextUnreachable = !nextNoNetwork && state.isInternetReachable === false;
  if (nextNoNetwork === noNetwork && nextUnreachable === unreachable) return;
  noNetwork = nextNoNetwork;
  unreachable = nextUnreachable;

  clearTimeout(debounceTimer);
  if (!noNetwork && !unreachable) {
    // Coming back online is reported immediately.
    setOffline(false);
  } else {
    debounceTimer = setTimeout(
      () => setOffline(true),
      noNetwork ? NO_NETWORK_DELAY_MS : UNREACHABLE_DELAY_MS,
    );
  }
  schedulePoll();
}

function poll() {
  NetInfo.refresh()
    .then(apply)
    .catch(() => {})
    .finally(schedulePoll);
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (AppState.currentState !== 'active') return;
  const suspect = offline || noNetwork || unreachable;
  pollTimer = setTimeout(poll, suspect ? POLL_OFFLINE_MS : POLL_ONLINE_MS);
}

NetInfo.addEventListener(apply);
AppState.addEventListener('change', (state) => {
  if (state === 'active') poll();
  else clearTimeout(pollTimer);
});
poll();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when the device has no usable internet connection. */
export function useIsOffline(): boolean {
  return useSyncExternalStore(subscribe, () => offline, () => offline);
}

/**
 * One-off check, for code outside React (e.g. before starting a payment).
 * Only "no network at all" counts: a failed reachability probe can be a
 * passing Wi-Fi handover, and a request that then fails still gets friendly
 * error copy (and nothing is charged).
 */
export async function isOfflineNow(): Promise<boolean> {
  const state = await NetInfo.refresh();
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
