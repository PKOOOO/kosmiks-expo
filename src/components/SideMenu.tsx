import React from "react";
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useClerk, useAuth } from "@clerk/clerk-expo";
import { unregisterPushToken } from "@/lib/push";
import { useT } from '@/i18n';

// New color scheme based on provided HEX codes
const darkBrown = "#423120"; // Main dark brown
const lightBrown = "#D7C3A7"; // Light brown/beige
const veryLightBeige = "#F4EDE5"; // Very light beige

interface SideMenuProps {
  onClose: () => void;
}

export default function SideMenu({ onClose }: SideMenuProps) {
  const { t } = useT();
  const router = useRouter();
  const { signOut } = useClerk();
  const { isSignedIn, getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  // Load all Philosopher font variants
  const [fontsLoaded] = useFonts({
    'Philosopher-Regular': require("../assets/app-fonts/Philosopher-Regular.ttf"),
    'Philosopher-Bold': require("../assets/app-fonts/Philosopher-Bold.ttf"),
    'Philosopher-Italic': require("../assets/app-fonts/Philosopher-Italic.ttf"),
    'Philosopher-BoldItalic': require("../assets/app-fonts/Philosopher-BoldItalic.ttf"),
  });

  // Handle sign out
  const handleSignOut = async () => {
    if (isSigningOut) return;
    
    setIsSigningOut(true);
    try {
      await unregisterPushToken(getToken);
      await signOut();
      onClose();
      router.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert(
        t('common.error'),
        t('common.signOutFailed'),
        [{ text: t('common.ok') }]
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
    { label: t('menu.categories'), onPress: handleCategories },
    {
      label: isSignedIn ? t('common.signOut') : t('common.signIn'),
      isSignOut: !!isSignedIn,
      onPress: isSignedIn ? handleSignOut : handleSignIn
    },
    {
      label: t('menu.forBusinesses'),
      onPress: () => {
        onClose();
        if (isSignedIn) {
          router.push('/admin-webview');
        } else {
          router.push('/sign-in?redirect=%2Fadmin-webview');
        }
      }
    },
    { label: t('menu.faq'), onPress: () => { onClose(); router.push('/info?tab=faq'); } },
    { label: t('menu.about'), onPress: () => { onClose(); router.push('/info?tab=about'); } },
    { label: t('menu.contact'), onPress: () => { onClose(); router.push('/info?tab=contact'); } },
    { label: t('menu.terms'), onPress: () => { onClose(); router.push('/info?tab=terms'); } },
    { label: t('menu.privacy'), onPress: () => { onClose(); router.push('/info?tab=privacy'); } },
  ];

  // Don't render if fonts aren't loaded
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: veryLightBeige, justifyContent: 'center', alignItems: 'center' }}>
        <Text>{t('common.loading')}</Text>
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
          const isSignOutItem = "isSignOut" in item && item.isSignOut;
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
