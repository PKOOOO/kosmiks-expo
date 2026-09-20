import { useRouter, useLocalSearchParams } from "expo-router";
import {
  Alert,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import React, { useCallback, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useOAuth, useAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import Header from "@/components/Header";
import SideMenu from "@/components/SideMenu";

// Color constants
const darkBrown = "#423120";
const lightBeige = "#F4EDE5";
const beigeBackground = "#D7C3A7";

// Warm up browser hook for faster OAuth
const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

export default function SignIn() {
  // Warm up browser on component mount
  useWarmUpBrowser();

  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const { isSignedIn, isLoaded: isClerkLoaded } = useAuth();

  // Let Clerk handle redirect URL automatically
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({
    strategy: "oauth_google",
  });
  const { startOAuthFlow: startAppleOAuth } = useOAuth({
    strategy: "oauth_apple",
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingProvider, setLoadingProvider] = React.useState<'google' | 'apple' | null>(null);
  const [isMenuVisible, setMenuVisible] = React.useState(false);

  // Handle OAuth session completion on mount
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  const redirectTo = useCallback(() => {
    let dest = typeof params.redirect === 'string' && params.redirect.length > 0 ? params.redirect : '/';
    try {
      dest = decodeURIComponent(dest);
    } catch { }
    router.replace(dest);
  }, [params.redirect, router]);

  // If user is already signed in, redirect immediately
  useEffect(() => {
    if (isSignedIn) {
      redirectTo();
    }
  }, [isSignedIn, redirectTo]);

  const handleGoogleSignIn = useCallback(async () => {
    if (isLoading) return;

    // Check if Clerk is loaded
    if (!isClerkLoaded) {
      Alert.alert(
        "Odota",
        "Sovellus latautuu vielä. Yritä uudelleen hetken kuluttua."
      );
      return;
    }

    setIsLoading(true);
    setLoadingProvider('google');

    try {
      const result = await startGoogleOAuth();

      if (result?.createdSessionId && result?.setActive) {
        await result.setActive({ session: result.createdSessionId });
        redirectTo();
      }
      // If no session created, user likely cancelled - no error needed
    } catch (err: any) {
      // Don't show error if user is actually signed in (success despite error)
      if (isSignedIn) {
        redirectTo();
        return;
      }

      // Ignore these non-error cases
      const errorCode = err?.errors?.[0]?.code;
      const errorMessage = err?.message || '';

      if (
        errorCode === 'user_cancelled' ||
        errorCode === 'session_exists' ||
        errorMessage.includes('user cancelled') ||
        errorMessage.includes('toString') // Ignore this known Clerk bug
      ) {
        // Check if we're signed in despite the error
        return;
      }

      // Show user-friendly error for real failures
      let displayMessage = 'Yritä uudelleen hetken kuluttua.';

      if (errorMessage.includes('Too many requests')) {
        displayMessage = 'Liian monta yritystä. Odota hetki ja yritä uudelleen.';
      } else if (err?.errors?.[0]?.longMessage) {
        displayMessage = err.errors[0].longMessage;
      }

      Alert.alert("Virhe", displayMessage);
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  }, [isLoading, isClerkLoaded, isSignedIn, startGoogleOAuth, redirectTo]);

  const handleAppleSignIn = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setLoadingProvider('apple');

    try {
      const { createdSessionId, setActive } = await startAppleOAuth();

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        // Small delay to ensure session is fully active before redirect
        setTimeout(() => {
          redirectTo();
        }, 100);
      }
    } catch (err: any) {
      console.error('Apple OAuth error:', JSON.stringify(err, null, 2));

      // Don't show error for user cancellation
      if (err?.errors?.[0]?.code !== 'user_cancelled') {
        Alert.alert(
          "Virhe",
          "Kirjautuminen Applella epäonnistui. Yritä uudelleen."
        );
      }
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  }, [isLoading, startAppleOAuth, redirectTo]);

  return (
    <View style={{ flex: 1, backgroundColor: beigeBackground }}>
      <Header
        title="SERVEY"
        showBack={true}
        showMenu={true}
        onBackPress={() => router.back()}
        onMenuPress={() => setMenuVisible(true)}
        disableSafeAreaPadding={false}
      />

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {/* Arch-shaped container */}
        <View style={{
          width: 300,
          height: 300,
          backgroundColor: lightBeige,
          borderTopLeftRadius: 150,
          borderTopRightRadius: 150,
          paddingHorizontal: 24,
          paddingTop: 60,
          paddingBottom: 40,
          marginBottom: 24,
          alignItems: 'center',
        }}>
          {/* Title */}
          <Text style={{
            fontSize: 20,
            fontFamily: 'Philosopher-Bold',
            color: darkBrown,
            textAlign: 'center',
            marginTop: 40,
          }}>
            Kirjaudu sisään
          </Text>

          {/* Google Sign In Button */}
          <TouchableOpacity
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            style={{
              width: 220,
              height: 50,
              backgroundColor: '#FFFFFF',
              borderRadius: 25,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 18,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
              opacity: isLoading && loadingProvider !== 'google' ? 0.6 : 1,
            }}
            activeOpacity={0.8}
          >
            {loadingProvider === 'google' ? (
              <ActivityIndicator size="small" color={darkBrown} />
            ) : (
              <>
                <View style={{ marginRight: 12 }}>
                  {/* Google Icon */}
                  <Ionicons name="logo-google" size={22} color="#4285F4" />
                </View>
                <Text style={{
                  color: darkBrown,
                  fontSize: 15,
                  fontFamily: 'Philosopher-Bold',
                }}>
                  Jatka Googlella
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple Sign In Button */}
          <TouchableOpacity
            onPress={handleAppleSignIn}
            disabled={isLoading}
            style={{
              width: 220,
              height: 50,
              backgroundColor: '#000000',
              borderRadius: 25,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              marginTop: 14,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 3,
              opacity: isLoading && loadingProvider !== 'apple' ? 0.6 : 1,
            }}
            activeOpacity={0.8}
          >
            {loadingProvider === 'apple' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <View style={{ marginRight: 12 }}>
                  {/* Apple Icon */}
                  <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
                </View>
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 15,
                  fontFamily: 'Philosopher-Bold',
                }}>
                  Jatka Applella
                </Text>
              </>
            )}
          </TouchableOpacity>

        </View>


      </View>

      {/* Modal for the side menu */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isMenuVisible}
        onRequestClose={() => setMenuVisible(false)}
        statusBarTranslucent={true}
      >
        <SideMenu onClose={() => setMenuVisible(false)} />
      </Modal>
    </View>
  );
}
