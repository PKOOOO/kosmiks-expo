import { DynamicColorIOS, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const inactive = '#8b7b63';

// DynamicColorIOS must only be evaluated on iOS.
const dynamicForeground =
  Platform.OS === "ios"
    ? DynamicColorIOS({ dark: "white", light: "black" })
    : "black";

function IosProviderTabs() {
  return (
    <NativeTabs
      tintColor={dynamicForeground}
      labelStyle={{ color: dynamicForeground }}
      minimizeBehavior="onScrollDown"
      shadowColor="transparent"
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger name="bookings">
        <NativeTabs.Trigger.Icon
          sf={{ default: "calendar", selected: "calendar" }}
          md="calendar_month"
        />
        <NativeTabs.Trigger.Label>Bookings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="services">
        <NativeTabs.Trigger.Icon
          sf={{ default: "scissors", selected: "scissors" }}
          md="content_cut"
        />
        <NativeTabs.Trigger.Label>Services</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="salon">
        <NativeTabs.Trigger.Icon
          sf={{ default: "storefront", selected: "storefront.fill" }}
          md="storefront"
        />
        <NativeTabs.Trigger.Label>Salon</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="payouts">
        <NativeTabs.Trigger.Icon
          sf={{ default: "creditcard", selected: "creditcard.fill" }}
          md="credit_card"
        />
        <NativeTabs.Trigger.Label>Payouts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="revenue">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "chart.line.uptrend.xyaxis",
            selected: "chart.line.uptrend.xyaxis",
          }}
          md="trending_up"
        />
        <NativeTabs.Trigger.Label>Revenue</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// Keep the existing themed tab bar unchanged on Android and web.
function AndroidProviderTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: beige,
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarActiveTintColor: darkBrown,
        tabBarInactiveTintColor: inactive,
        tabBarLabelStyle: {
          fontFamily: 'Philosopher-Regular',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cut-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="salon"
        options={{
          title: 'Salon',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="payouts"
        options={{
          title: 'Payouts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="revenue"
        options={{
          title: 'Revenue',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function ProviderLayout() {
  return Platform.OS === "ios" ? (
    <IosProviderTabs />
  ) : (
    <AndroidProviderTabs />
  );
}
