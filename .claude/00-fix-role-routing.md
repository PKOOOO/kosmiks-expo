# Fix: Role Routing in admin-webview.tsx

**Repo:** `cosmix-v2`
**File:** `src/app/admin-webview.tsx`

## Problem
Current implementation calls `GET /api/saloons` as a second request to
determine if a user is a provider. This is unnecessary — `GET /api/admin/check`
already returns `hasSaloons: boolean` in its response.

## Fix — simplify checkAdminStatus

```ts
const res = await fetch(`${API_URL}/api/admin/check`, {
  headers: { Authorization: `Bearer ${token}` }
})
const data = await res.json()
// data = { isAdmin: boolean, hasSaloons: boolean, user: {...} }

if (data.isAdmin) {
  setUserRole('admin')
} else if (data.hasSaloons) {
  setUserRole('provider')
} else {
  setUserRole('customer')
}
```

## Navigation effect (unchanged logic, just cleaner)
```ts
useEffect(() => {
  if (userRole === 'admin')    router.replace('/(admin)/overview')
  if (userRole === 'provider') router.replace('/(provider)/bookings')
  if (userRole === 'customer') router.replace('/(app)/(tabs)/')
}, [userRole])
```

## Remove
- The second `GET /api/saloons` call entirely
- Any WebView rendering for admin — admin now goes to native `/(admin)/` stack
- The WebView component and all its token injection logic can be deleted

## Rules
- Keep the sign-out reset logic (`setUserRole(null)` on user switch)
- Always wait for `isLoaded === true` before calling checkAdminStatus
- Show a loading spinner while role is null
