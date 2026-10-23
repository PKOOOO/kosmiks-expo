// src/app/(app)/(tabs)/_layout.tsx
import { Platform, DynamicColorIOS } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Tabs } from "expo-router";
import TabBar from "@/components/TabBar";

// Tab opened first (replaces the old `initialRouteName` prop on <Tabs>).
export const unstable_settings = { initialRouteName: 'index' };

// DynamicColorIOS is iOS-only — calling it on Android throws at module load.
const dynamicForeground =
  Platform.OS === "ios"
    ? DynamicColorIOS({ dark: "white", light: "black" })
    : "black";

// iOS: native "liquid glass" tab bar.
function IosTabs() {
  return (
    <NativeTabs
      tintColor={dynamicForeground}
      labelStyle={{ color: dynamicForeground }}
      minimizeBehavior="onScrollDown"
      shadowColor="transparent"
      disableTransparentOnScrollEdge
    >
      {/* Profile */}
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
        <NativeTabs.Trigger.Label hidden>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {/* Search / Service */}
      <NativeTabs.Trigger name="service">
        <NativeTabs.Trigger.Icon
          sf={{ default: "magnifyingglass", selected: "magnifyingglass" }}
          md="search"
        />
        <NativeTabs.Trigger.Label hidden>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {/* Home (default) */}
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label hidden>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// Android: floating pill tab bar with a circular active indicator.
function AndroidTabs() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="service" options={{ title: "Search" }} />
      <Tabs.Screen name="index" options={{ title: "Home" }} />
    </Tabs>
  );
}

function Layout() {
  return Platform.OS === "ios" ? <IosTabs /> : <AndroidTabs />;
}

export default Layout;
