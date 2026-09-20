import "../global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { Slot } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { StripeProvider } from "@/lib/stripe";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_ENDPOINTS } from "@/config/constants";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Read the EAS projectId from the build config so it can never drift from the
// project this app was actually built under (a mismatch makes
// getExpoPushTokenAsync throw on standalone builds). Expo's recommended pattern.
const EXPO_PUSH_PROJECT_ID =
  Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
const PUSH_TOKEN_STORAGE_KEY = "expoPushToken";

// Registers the device for push notifications once the user is signed in,
// and reports the Expo push token to the backend.
function PushNotificationRegistrar() {
  if (isExpoGo) {
    return null;
  }

  const Notifications = require("expo-notifications");

  // Show notifications while the app is in the foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const { isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    (async () => {
      try {
        if (!Device.isDevice) {
          return;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          // Expected when a user declines, but a silently unreachable device is
          // hard to diagnose later — surface the status.
          console.warn("[PUSH] Permission not granted:", finalStatus);
          return;
        }

        // Android 8+ drops any notification that has no channel, even when FCM
        // delivered it. iOS ignores channels. Create the default channel first.
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#423120",
          });
        }

        if (!EXPO_PUSH_PROJECT_ID) {
          console.error("[PUSH] No projectId in app config (extra.eas.projectId); cannot register.");
          return;
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId: EXPO_PUSH_PROJECT_ID,
        });
        const pushToken = tokenResponse.data;

        await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, pushToken);

        const adminApiKey = process.env.EXPO_PUBLIC_ADMIN_API_KEY || "";
        const clerkToken = await getToken();

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (adminApiKey) headers["Authorization"] = `Bearer ${adminApiKey}`;
        if (clerkToken) headers["X-User-Token"] = clerkToken;

        const res = await fetch(API_ENDPOINTS.PUSH_TOKEN, {
          method: "POST",
          headers,
          body: JSON.stringify({ pushToken }),
        });
        if (!res.ok) {
          const bodyText = await res.text().catch(() => "<no body>");
          console.error("[PUSH] Token registration failed. HTTP", res.status, bodyText);
        }
      } catch (error: any) {
        // Swallow point: a projectId mismatch or FCM/Firebase init failure throws here.
        console.error("[PUSH] Registration failed:", error?.message ?? error);
      }
    })();
  }, [isSignedIn]);

  return null;
}

// Custom token cache implementation
const tokenCache = {
  async getToken(key: string) {
    try {
      const value = await SecureStore.getItemAsync(key);
      console.log('TokenCache getToken:', key, value ? 'found' : 'not found');
      return value;
    } catch (error) {
      console.error('TokenCache getToken error:', error);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      console.log('TokenCache saveToken:', key);
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('TokenCache saveToken error:', error);
    }
  },
  async clearToken(key: string) {
    try {
      console.log('TokenCache clearToken:', key);
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('TokenCache clearToken error:', error);
    }
  },
};

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

if (!publishableKey) {
  throw new Error(
    "Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env file."
  );
}

if (!stripePublishableKey) {
  console.warn(
    "Missing Stripe Publishable Key. Please set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in your .env file."
  );
}

// Inner component that handles Clerk loading with timeout
function ClerkLoadedWithTimeout({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // If Clerk doesn't load within 10 seconds, proceed anyway (but OAuth won't work)
    const timeout = setTimeout(() => {
      if (!isLoaded) {
        console.warn('Clerk initialization timed out after 10 seconds');
        setTimedOut(true);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [isLoaded]);

  // Log Clerk loading status
  useEffect(() => {
    console.log('Clerk isLoaded:', isLoaded);
  }, [isLoaded]);

  // Render children if Clerk loaded OR if we timed out
  if (isLoaded || timedOut) {
    return <>{children}</>;
  }

  // Return null while waiting (splash screen is still visible)
  return null;
}

export default function Layout() {
  // Load all Philosopher fonts at the root level
  const [fontsLoaded, fontError] = useFonts({
    'Philosopher-Regular': require("../assets/app-fonts/Philosopher-Regular.ttf"),
    'Philosopher-Bold': require("../assets/app-fonts/Philosopher-Bold.ttf"),
    'Philosopher-Italic': require("../assets/app-fonts/Philosopher-Italic.ttf"),
    'Philosopher-BoldItalic': require("../assets/app-fonts/Philosopher-BoldItalic.ttf"),
  });

  useEffect(() => {
    if (fontError) throw fontError;
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoadedWithTimeout>
        <PushNotificationRegistrar />
        <StripeProvider
          publishableKey={stripePublishableKey}
          merchantIdentifier="merchant.com.servey.app"
          urlScheme="servey"
        >
          <SafeAreaProvider>
            <GluestackUIProvider mode="light">
              <Slot />
            </GluestackUIProvider>
          </SafeAreaProvider>
        </StripeProvider>
      </ClerkLoadedWithTimeout>
    </ClerkProvider>
  );
}
