import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, usePathname, Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

const activeColor = "#423120";
const inactiveColor = "rgba(66,49,32,0.38)";

const tabs = [
  {
    name: "profile",
    icon: { default: "person-outline" as const, active: "person" as const },
    route: "/(app)/(tabs)/profile" as Href,
  },
  {
    name: "service",
    icon: { default: "search-outline" as const, active: "search" as const },
    route: "/(app)/(tabs)/service" as Href,
  },
  {
    name: "index",
    icon: { default: "home-outline" as const, active: "home" as const },
    route: "/(app)/(tabs)/index" as Href,
  },
];

export default function GlobalTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isTabActive = (tab: (typeof tabs)[0]) => {
    if (
      tab.name === "index" &&
      (pathname === "/" || pathname === "/(app)/(tabs)/index")
    )
      return true;
    if (pathname === tab.route) return true;
    return false;
  };

  const bottom = Math.max(insets.bottom, 12) + 4;

  return (
    <View style={[styles.shadow, { bottom }]}>
      <View style={styles.pill}>
        {/* On iOS: native blur. On Android: solid fallback */}
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={92}
            tint="systemChromeMaterialLight"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(245, 240, 235, 0.92)" },
            ]}
          />
        )}

        {/* Frosted tint overlay — warm beige to match your app theme */}
        <View style={styles.tintOverlay} />
        {/* Glass edge highlight */}
        <View style={styles.edgeHighlight} />

        {/* Tab buttons */}
        <View style={styles.row}>
          {tabs.map((tab) => {
            const active = isTabActive(tab);
            return (
              <TouchableOpacity
                key={tab.name}
                accessibilityRole="button"
                accessibilityState={active ? { selected: true } : {}}
                onPress={() => router.push(tab.route)}
                activeOpacity={0.6}
                style={styles.btn}
              >
                <Ionicons
                  name={active ? tab.icon.active : tab.icon.default}
                  size={25}
                  color={active ? activeColor : inactiveColor}
                />
                {active && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 58,
    zIndex: 1000,
    // Shadow must be on the OUTER view (no overflow:hidden here)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  pill: {
    flex: 1,
    borderRadius: 30,
    overflow: "hidden", // clips blur + overlays to pill shape
  },
  tintOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Warm semi-transparent tint so pill is visible even on white
    backgroundColor: "rgba(235, 225, 215, 0.45)",
  },
  edgeHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
  },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  dot: {
    position: "absolute",
    bottom: 8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: activeColor,
  },
});
