import { useEffect, useRef } from 'react';
import { DynamicColorIOS, Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Tabs, useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import TabBar from '@/components/TabBar';
import { useAdminStore, useAdminBadges } from '@/lib/admin-api';

// Tab opened first (replaces the old `initialRouteName` prop on <Tabs>).
export const unstable_settings = { initialRouteName: 'home' };

const badgeGreen = '#25D366';
const badgeAmber = '#C08A3E';

// DynamicColorIOS must only be evaluated on iOS.
const dynamicForeground =
  Platform.OS === 'ios'
    ? DynamicColorIOS({ dark: 'white', light: 'black' })
    : 'black';

// iOS: native Liquid Glass tab bar (same as the provider dashboard).
function IosAdminTabs({ reviewCount, toSendCount, hidden }: { reviewCount: number; toSendCount: number; hidden: boolean }) {
  return (
    <NativeTabs
      hidden={hidden}
      tintColor={dynamicForeground}
      labelStyle={{ color: dynamicForeground }}
      badgeBackgroundColor={badgeGreen}
      minimizeBehavior="onScrollDown"
      shadowColor="transparent"
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label hidden>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="applications">
        <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} md="description" />
        <NativeTabs.Trigger.Label hidden>Applications</NativeTabs.Trigger.Label>
        {/* Rendered only when non-zero: the native badge shows "0" even with hidden set. */}
        {reviewCount > 0 && (
          <NativeTabs.Trigger.Badge selectedBackgroundColor={badgeAmber}>
            {String(reviewCount)}
          </NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="payouts">
        <NativeTabs.Trigger.Icon sf={{ default: 'banknote', selected: 'banknote.fill' }} md="payments" />
        <NativeTabs.Trigger.Label hidden>Payouts</NativeTabs.Trigger.Label>
        {/* Rendered only when non-zero: the native badge shows "0" even with hidden set. */}
        {toSendCount > 0 && (
          <NativeTabs.Trigger.Badge selectedBackgroundColor={badgeAmber}>
            {String(toSendCount)}
          </NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="saloons">
        <NativeTabs.Trigger.Icon sf={{ default: 'storefront', selected: 'storefront.fill' }} md="storefront" />
        <NativeTabs.Trigger.Label hidden>Salons</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="catalog">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="grid_view" />
        <NativeTabs.Trigger.Label hidden>Catalog</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// Android: the floating pill tab bar used across the app.
function AndroidAdminTabs({ reviewCount, toSendCount, hidden }: { reviewCount: number; toSendCount: number; hidden: boolean }) {
  return (
    <Tabs
      tabBar={(props) => (hidden ? null : <TabBar {...props} />)}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen
        name="applications"
        options={{ title: 'Applications', tabBarBadge: reviewCount > 0 ? reviewCount : undefined }}
      />
      <Tabs.Screen
        name="payouts"
        options={{ title: 'Payouts', tabBarBadge: toSendCount > 0 ? toSendCount : undefined }}
      />
      <Tabs.Screen name="saloons" options={{ title: 'Salons' }} />
      <Tabs.Screen name="catalog" options={{ title: 'Catalog' }} />
    </Tabs>
  );
}

export default function AdminLayout() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const loadApplications = useAdminStore(s => s.loadApplications);
  const loadPayouts = useAdminStore(s => s.loadPayouts);
  const { reviewCount, toSendCount } = useAdminBadges();
  // Hide the tab bar on pages pushed inside a tab (details, users…), so their
  // footers and last rows aren't covered. Segments omit `index`, so a tab's
  // root is two segments deep: ['(admin)', 'applications'].
  const segments = useSegments();
  const hidden = segments.length > 2;

  // Prime the badge counts; each screen refreshes its own data on focus.
  useEffect(() => {
    const getTokenFn = () => getTokenRef.current();
    loadApplications(getTokenFn).catch(() => undefined);
    loadPayouts(getTokenFn).catch(() => undefined);
  }, [loadApplications, loadPayouts]);

  return Platform.OS === 'ios'
    ? <IosAdminTabs reviewCount={reviewCount} toSendCount={toSendCount} hidden={hidden} />
    : <AndroidAdminTabs reviewCount={reviewCount} toSendCount={toSendCount} hidden={hidden} />;
}
