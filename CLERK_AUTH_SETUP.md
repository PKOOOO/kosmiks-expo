# Clerk Auth — Google & Apple Sign-In (Expo)

A step-by-step guide to add **"Continue with Google" / "Continue with Apple"** button-click sign-in to any Expo (React Native) app using Clerk.

> Scope: **only** social sign-in (Google + Apple) via OAuth buttons. No email/password, no admin tokens, no backend session syncing.

---

## 1. Install dependencies

```bash
npx expo install @clerk/clerk-expo expo-web-browser expo-secure-store expo-auth-session
# Apple native button / native flow (iOS)
npx expo install expo-apple-authentication
```

Versions known to work together:

| Package | Version |
|---------|---------|
| `@clerk/clerk-expo` | `^2.19.6` |
| `expo` | `^54.0.25` |
| `expo-router` | `~6.0.15` |
| `expo-web-browser` | `^15.0.9` |
| `expo-secure-store` | `~15.0.7` |
| `expo-auth-session` | `^7.0.9` |
| `expo-apple-authentication` | `^8.0.7` |

---

## 2. Configure Clerk dashboard

1. Create an app at [dashboard.clerk.com](https://dashboard.clerk.com).
2. **User & Authentication → Social Connections** → enable **Google** and **Apple**.
   - For quick testing you can use Clerk's shared/dev OAuth credentials.
   - For production you must add your **own** Google OAuth client and Apple Services ID (see step 6).
3. Copy your **Publishable Key** (`pk_test_...` / `pk_live_...`).

---

## 3. Environment variable

`.env`:

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxx
```

Expo automatically exposes any `EXPO_PUBLIC_*` var to the JS bundle.

---

## 4. App scheme (required for the OAuth redirect)

The OAuth browser needs a deep-link scheme to return to your app.

`app.json`:

```json
{
  "expo": {
    "scheme": "myapp",
    "ios": { "bundleIdentifier": "com.you.myapp" },
    "android": { "package": "com.you.myapp" }
  }
}
```

The scheme is what Clerk uses to build the redirect URL automatically (e.g. `myapp://`).

---

## 5. Wrap the app in `ClerkProvider`

In your root layout (`app/_layout.tsx` for expo-router). The **token cache** keeps the user signed in between app launches via secure storage.

```tsx
import { ClerkProvider } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { Slot } from "expo-router";

// Persist the Clerk session token in the device secure store
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
};

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env");
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <Slot />
    </ClerkProvider>
  );
}
```

---

## 6. The sign-in screen (Google + Apple buttons)

This is the whole flow — two buttons, each calling `useOAuth().startOAuthFlow()`.

```tsx
import React, { useCallback, useEffect, useState } from "react";
import { TouchableOpacity, Text, View, Alert, ActivityIndicator } from "react-native";
import { useOAuth, useAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";

// Warms up the in-app browser so OAuth opens faster
const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => void WebBrowser.coolDownAsync();
  }, []);
};

export default function SignIn() {
  useWarmUpBrowser();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  // Clerk builds the redirect URL automatically from your app scheme
  const { startOAuthFlow: startGoogle } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startApple } = useOAuth({ strategy: "oauth_apple" });

  const [loading, setLoading] = useState<null | "google" | "apple">(null);

  // Required so the OAuth redirect can complete the auth session
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  // Already signed in? Leave the screen.
  useEffect(() => {
    if (isSignedIn) router.replace("/");
  }, [isSignedIn]);

  const signInWith = useCallback(
    async (provider: "google" | "apple") => {
      if (loading || !isLoaded) return;
      setLoading(provider);
      try {
        const flow = provider === "google" ? startGoogle : startApple;
        const { createdSessionId, setActive } = await flow();

        // createdSessionId is null if the user cancelled — that's fine
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          router.replace("/");
        }
      } catch (err: any) {
        if (err?.errors?.[0]?.code !== "user_cancelled") {
          Alert.alert("Sign-in failed", "Please try again.");
        }
      } finally {
        setLoading(null);
      }
    },
    [loading, isLoaded, startGoogle, startApple]
  );

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
      <TouchableOpacity
        onPress={() => signInWith("google")}
        disabled={!!loading}
        style={{ height: 50, borderRadius: 25, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}
      >
        {loading === "google" ? <ActivityIndicator /> : <Text>Continue with Google</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => signInWith("apple")}
        disabled={!!loading}
        style={{ height: 50, borderRadius: 25, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}
      >
        {loading === "apple" ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff" }}>Continue with Apple</Text>}
      </TouchableOpacity>
    </View>
  );
}
```

### What happens on button click
1. `startOAuthFlow()` opens the system browser to Google/Apple.
2. User authenticates → browser redirects back to `myapp://` (your scheme).
3. Clerk returns a `createdSessionId`.
4. `setActive({ session })` makes that session the active one → `isSignedIn` becomes `true`.

---

## 7. Reading the signed-in user anywhere

```tsx
import { useUser, useAuth } from "@clerk/clerk-expo";

function Profile() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  if (!isSignedIn) return null;

  return (
    <>
      <Text>{user?.fullName}</Text>
      <Text>{user?.primaryEmailAddress?.emailAddress}</Text>
    </>
  );
}
```

Detect which provider they used:

```tsx
const provider = user?.externalAccounts?.[0]?.provider; // "google" | "apple"
```

---

## 8. Sign out

```tsx
import { useAuth } from "@clerk/clerk-expo";

const { signOut } = useAuth();
// ...
<TouchableOpacity onPress={() => signOut()}>
  <Text>Sign out</Text>
</TouchableOpacity>
```

---

## 9. Native build requirements (EAS)

OAuth needs **native code** — it does **not** work in Expo Go. Use a dev build.

```bash
npm install -g eas-cli
eas login
eas build:configure

# Dev client (lets you run the OAuth flow locally)
eas build --profile development --platform ios
eas build --profile development --platform android

# Then run with the dev client
npx expo start --dev-client
```

Production builds:

```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```

> Add `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to your EAS env / secrets so it's present in the build.

---

## 10. Production OAuth credentials (before App Store / Play Store)

Clerk's shared dev credentials only work in development. For production:

- **Google:** Create an OAuth Client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → paste Client ID + Secret into Clerk → Google connection.
- **Apple:** Requires Apple Developer account. Create a **Services ID** + key, configure **Sign in with Apple**, then paste into Clerk → Apple connection.
  - iOS apps **must** offer Sign in with Apple if they offer any other social login (App Store rule).

Clerk's dashboard shows the exact **redirect/callback URLs** to paste into Google/Apple — copy them from there.

---

## Checklist

- [ ] `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` set in `.env`
- [ ] `scheme` set in `app.json`
- [ ] Google + Apple enabled in Clerk dashboard
- [ ] App wrapped in `<ClerkProvider>` with `tokenCache`
- [ ] `WebBrowser.maybeCompleteAuthSession()` called on the sign-in screen
- [ ] Tested in an **EAS dev build** (not Expo Go)
- [ ] Production OAuth credentials added before release
</content>
</invoke>
