import { useEffect } from 'react';
import { DynamicColorIOS, Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Tabs, useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import TabBar from '@/components/TabBar';
import { API_BASE_URL } from '@/config/constants';
import useProviderServicesStore from '@/store/provider-services.store';

// Tab opened first (replaces the old `initialRouteName` prop on <Tabs>).
export const unstable_settings = { initialRouteName: 'bookings' };

const badgeGreen = '#25D366';

// DynamicColorIOS must only be evaluated on iOS.
const dynamicForeground =
  Platform.OS === "ios"
    ? DynamicColorIOS({ dark: "white", light: "black" })
    : "black";

function IosProviderTabs({ serviceCount, tabBarHidden }: { serviceCount: number; tabBarHidden: boolean }) {
  return (
    <NativeTabs
      hidden={tabBarHidden}
      tintColor={dynamicForeground}
      labelStyle={{ color: dynamicForeground }}
      badgeBackgroundColor={badgeGreen}
      minimizeBehavior="onScrollDown"
      shadowColor="transparent"
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger name="bookings">
        <NativeTabs.Trigger.Icon
          sf={{ default: "calendar.badge.clock", selected: "calendar.badge.clock" }}
          md="calendar_month"
        />
        <NativeTabs.Trigger.Label hidden>Bookings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="services">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "list.bullet.rectangle.portrait",
            selected: "list.bullet.rectangle.portrait.fill",
          }}
          md="content_cut"
        />
        <NativeTabs.Trigger.Label hidden>Services</NativeTabs.Trigger.Label>
        {/* Rendered only when non-zero: the native badge shows "0" even with hidden set. */}
        {serviceCount > 0 && (
          <NativeTabs.Trigger.Badge selectedBackgroundColor={badgeGreen}>
            {String(serviceCount)}
          </NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="salon">
        <NativeTabs.Trigger.Icon
          sf={{ default: "storefront", selected: "storefront.fill" }}
          md="storefront"
        />
        <NativeTabs.Trigger.Label hidden>Salon</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="payouts">
        <NativeTabs.Trigger.Icon
          sf={{ default: "banknote", selected: "banknote.fill" }}
          md="credit_card"
        />
        <NativeTabs.Trigger.Label hidden>Earnings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// Android uses the same floating pill pattern as the customer app.
function AndroidProviderTabs({ serviceCount, tabBarHidden }: { serviceCount: number; tabBarHidden: boolean }) {
  return (
    <Tabs
      tabBar={(props) => tabBarHidden ? null : <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="bookings"
        options={{ title: 'Bookings' }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarBadge: serviceCount > 0 ? serviceCount : undefined,
        }}
      />
      <Tabs.Screen
        name="salon"
        options={{ title: 'Salon' }}
      />
      <Tabs.Screen
        name="payouts"
        options={{ title: 'Earnings' }}
      />
    </Tabs>
  );
}

export default function ProviderLayout() {
  const { getToken } = useAuth();
  const serviceCount = useProviderServicesStore(state => state.count);
  const setServiceCount = useProviderServicesStore(state => state.setCount);
  const storeTabBarHidden = useProviderServicesStore(state => state.tabBarHidden);
  // Also hide it on pages pushed inside a tab (e.g. Earnings → payout, bank).
  const segments = useSegments();
  const tabBarHidden = storeTabBarHidden || segments.length > 2;

  useEffect(() => {
    let active = true;

    const loadServiceCount = async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token ?? ''}`,
        };
        if (token) headers['X-User-Token'] = token;

        const saloonResponse = await fetch(`${API_BASE_URL}/saloons?owned=1`, { headers });
        if (!saloonResponse.ok) return;
        const saloons = await saloonResponse.json();
        if (!Array.isArray(saloons) || saloons.length === 0) {
          if (active) setServiceCount(0);
          return;
        }

        const servicesResponse = await fetch(
          `${API_BASE_URL}/saloons/${saloons[0].id}/services`,
          { headers }
        );
        if (!servicesResponse.ok) return;
        const services = await servicesResponse.json();
        if (active) setServiceCount(Array.isArray(services) ? services.length : 0);
      } catch {
        // The Services screen retries and synchronizes the badge when opened.
      }
    };

    loadServiceCount();
    return () => {
      active = false;
    };
  }, [getToken, setServiceCount]);

  return Platform.OS === "ios" ? (
    <IosProviderTabs serviceCount={serviceCount} tabBarHidden={tabBarHidden} />
  ) : (
    <AndroidProviderTabs serviceCount={serviceCount} tabBarHidden={tabBarHidden} />
  );
}
