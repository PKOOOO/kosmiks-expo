import { View, TouchableOpacity, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const activeColor = "#423120"; // Dark Brown for active
const inactiveColor = "#8b7b63ff"; // Grey for inactive
const tabBackground = "#D7C3A7";

export default function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: tabBackground,
        borderTopWidth: 0,
        paddingBottom: insets.bottom,
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          height: 60,
          justifyContent: "space-around",
          alignItems: "center",
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          // Map route names to icons
          let iconName;
          if (route.name === "index") {
            iconName = "home-outline";
          } else if (route.name === "service") {
            iconName = "search-outline";
          } else if (route.name === "profile") {
            iconName = "person";
          } else {
            return null; // Don't render unknown routes
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={1} // Disable opacity change on press
              style={{
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
              }}
            >
              <Ionicons
                name={iconName as any}
                size={30}
                color={isFocused ? activeColor : inactiveColor}
                style={{ opacity: 1 }} // Enforce solid opacity
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}