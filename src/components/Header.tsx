// src/app/components/Header.tsx
import { View, TouchableOpacity, Dimensions, Text, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface HeaderProps {
  title?: string;
  showMenu?: boolean;
  showBack?: boolean;
  onMenuPress?: () => void;
  onBackPress?: () => void;
  /** Set to true when Header is inside SafeAreaView to prevent double padding on iOS */
  disableSafeAreaPadding?: boolean;
}

const darkBrown = "#423120";
const white = "#FFFFFF";
const { width } = Dimensions.get('window');

// Fixed header height
const HEADER_HEIGHT = 48;

export default function Header({
  title = "SERVEY",
  showMenu = true,
  showBack = false,
  onMenuPress,
  onBackPress,
  disableSafeAreaPadding = false
}: HeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Add top padding for status bar on both platforms
  // On Android, SafeAreaView doesn't always work, so we add padding
  // On iOS, we also add padding to ensure proper positioning
  // When disableSafeAreaPadding is true (Header is inside SafeAreaView), don't add padding
  // However, on Android, SafeAreaView often doesn't apply the top padding correctly,
  // so we should only disable the padding on iOS to avoid the "all the way up" issue on Android.
  const topPadding = (Platform.OS === 'ios' && disableSafeAreaPadding) ? 0 : insets.top;

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      // Check if we can go back before calling router.back()
      if (router.canGoBack()) {
        router.back();
      } else {
        // If we can't go back, navigate to home
        router.push('/');
      }
    }
  };

  const handleMenuPress = () => {
    if (onMenuPress) {
      onMenuPress();
    }
  };

  const handleTitlePress = () => {
    router.push('/');
  };

  return (
    <View
      style={{
        backgroundColor: white,
        borderBottomWidth: 0.5,
        borderBottomColor: '#ffffffff',
        elevation: 2,
        width: width,
        alignSelf: 'stretch',
        paddingTop: topPadding,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          height: HEADER_HEIGHT,
        }}
      >
        {/* Back Button (left side) */}
        {showBack ? (
          <TouchableOpacity
            onPress={handleBackPress}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-back" size={24} color={darkBrown} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}

        {/* Title (center) - absolutely positioned to stay centered */}
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "box-none",
          }}
        >
          <TouchableOpacity
            onPress={handleTitlePress}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={{
                fontSize: 20,
                fontFamily: "Philosopher-Bold",
                fontWeight: "700",
                color: darkBrown,
                letterSpacing: 3,
              }}
            >
              {title}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Menu Button (right side) */}
        {showMenu ? (
          <TouchableOpacity
            onPress={handleMenuPress}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Ionicons name="menu" size={28} color={darkBrown} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>
    </View>
  );
}