---
description: Build the native ProviderStack navigator in Expo — replaces WebView for providers
globs: ["**/app/(provider)/**", "**/admin-webview.tsx"]
alwaysApply: false
---

# Provider Navigator — Native Screens (replaces WebView)

## Goal
Remove WebView for providers. Build a native `ProviderStack` with tab navigation.
Admin users still use WebView (`admin-webview.tsx`) for now — do not touch that.

## File to create: `cosmix-v2/src/app/(provider)/_layout.tsx`
```tsx
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function ProviderLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="bookings"
        options={{ title: 'Bookings', tabBarIcon: ({ color }) => <Ionicons name="calendar" color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="services"
        options={{ title: 'Services', tabBarIcon: ({ color }) => <Ionicons name="cut" color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="salon"
        options={{ title: 'Salon', tabBarIcon: ({ color }) => <Ionicons name="storefront" color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="payouts"
        options={{ title: 'Payouts', tabBarIcon: ({ color }) => <Ionicons name="card" color={color} size={24} /> }}
      />
    </Tabs>
  )
}
```

## Refactor `cosmix-v2/src/app/admin-webview.tsx`
Replace the current logic that sends ALL non-customers to WebView with:

```ts
const { user } = useUser()
const isAdmin = user?.publicMetadata?.isAdmin === true

// Check if user owns a saloon (call GET /api/saloons/mine or check DB)
const isProvider = !isAdmin && userOwnsSaloon

if (isAdmin) {
  // Keep existing WebView logic → loads /admin
  return <AdminWebView />
}

if (isProvider) {
  // Route to native provider tabs
  router.replace('/(provider)/bookings')
  return null
}

// Default — customer
router.replace('/(app)/(tabs)/')
return null
```

## Rules
- Do NOT remove admin WebView logic
- Provider routing must happen after Clerk session is loaded (`isLoaded === true`)
- Show a loading spinner while checking role
- The provider saloon check should use an existing API call, not a new endpoint
