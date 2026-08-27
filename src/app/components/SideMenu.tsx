import React from "react";
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useClerk, useAuth } from "@clerk/clerk-expo";

// New color scheme based on provided HEX codes
const darkBrown = "#423120"; // Main dark brown
const lightBrown = "#D7C3A7"; // Light brown/beige
const veryLightBeige = "#F4EDE5"; // Very light beige

interface SideMenuProps {
  onClose: () => void;
}

export default function SideMenu({ onClose }: SideMenuProps) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  // Load all Philosopher font variants
  const [fontsLoaded] = useFonts({
    'Philosopher-Regular': require("../assets/fonts/Philosopher-Regular.ttf"),
    'Philosopher-Bold': require("../assets/fonts/Philosopher-Bold.ttf"),
    'Philosopher-Italic': require("../assets/fonts/Philosopher-Italic.ttf"),
    'Philosopher-BoldItalic': require("../assets/fonts/Philosopher-BoldItalic.ttf"),
  });

  // Handle sign out
  const handleSignOut = async () => {
    if (isSigningOut) return;
    
    setIsSigningOut(true);
    try {
      await signOut();
      onClose();
      router.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert(
        'Virhe',
        'Kirjautuminen ulos epäonnistui. Yritä uudelleen.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  // Handle sign in navigation
  const handleSignIn = () => {
    onClose();
    router.push('/sign-in');
  };

  // Handle categories navigation
  const handleCategories = () => {
    onClose();
    router.push('/categories');
  };

  // Side menu items
  const menuItems = [
    { label: "Kategoriat", onPress: handleCategories },
    {
      label: isSignedIn ? "Kirjaudu ulos" : "Kirjaudu sisään",
      onPress: isSignedIn ? handleSignOut : handleSignIn
    },
    {
      label: "Yrittäjille",
      onPress: () => {
        onClose();
        if (isSignedIn) {
          router.push('/admin-webview');
        } else {
          router.push('/sign-in?redirect=%2Fadmin-webview');
        }
      }
    },
    { label: "Usein kysytyt kysymykset", onPress: () => { onClose(); router.push('/info?tab=faq'); } },
    { label: "Meistä", onPress: () => { onClose(); router.push('/info?tab=about'); } },
    { label: "Ota yhteyttä", onPress: () => { onClose(); router.push('/info?tab=contact'); } },
    { label: "Käyttöehdot", onPress: () => { onClose(); router.push('/info?tab=terms'); } },
    { label: "Tietosuojaseloste", onPress: () => { onClose(); router.push('/info?tab=privacy'); } },
  ];

  // Don't render if fonts aren't loaded
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: veryLightBeige, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: veryLightBeige, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Close button */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 }}>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.7}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Ionicons name="menu" size={37} color={darkBrown} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 32, paddingTop: 15 }}>
        {menuItems.map((item, index) => {
          const isSignOutItem = item.label === "Kirjaudu ulos";
          const isLoading = isSignOutItem && isSigningOut;
          
          return (
            <TouchableOpacity
              key={index}
              onPress={item.onPress}
              disabled={isLoading}
              style={{ marginBottom: 24, opacity: isLoading ? 0.6 : 1 }}
            >
              {isLoading ? (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={darkBrown} style={{ marginRight: 8 }} />
                  <Text
                    style={{
                      fontSize: 25,
                      fontFamily: "Philosopher-Bold",
                      textAlign: "right",
                      color: darkBrown,
                      lineHeight: 40,
                    }}
                  >
                    {item.label}
                  </Text>
                </View>
              ) : (
                <Text
                  style={{
                    fontSize: 25,
                    fontFamily: "Philosopher-Bold",
                    textAlign: "right",
                    color: darkBrown,
                    lineHeight: 40,
                  }}
                >
                  {item.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
