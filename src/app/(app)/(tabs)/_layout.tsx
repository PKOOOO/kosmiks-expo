// src/app/(app)/(tabs)/_layout.tsx
import { Platform, DynamicColorIOS } from "react-native";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { Tabs } from "expo-router";
import TabBar from "../../components/TabBar";

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
      backgroundColor={null}
      shadowColor="transparent"
      disableTransparentOnScrollEdge
    >
      {/* Profile */}
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
        <Label>Profile</Label>
      </NativeTabs.Trigger>

      {/* Search / Service */}
      <NativeTabs.Trigger name="service">
        <Icon
          sf={{ default: "magnifyingglass", selected: "magnifyingglass" }}
          md="search"
        />
        <Label>Search</Label>
      </NativeTabs.Trigger>

      {/* Home (default) */}
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <Label>Home</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// Android: the original custom TabBar. NativeTabs' liquid-glass styling does not
// translate to Android, so we keep the plain themed bar instead.
function AndroidTabs() {
  return (
    <Tabs
      initialRouteName="index"
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
