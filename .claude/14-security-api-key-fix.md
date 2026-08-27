# Phase 2: Security Fix — Replace Shared API Key

**Repo:** `cosmix-v2` + `cosmix-admin`

## Problem
`EXPO_PUBLIC_ADMIN_API_KEY` is a shared secret compiled into the JS bundle.
Anyone can decompile the Expo app and extract it, then call any API route.

## Step 1 — Audit all usages in cosmix-v2

Find every file using the shared key:
```bash
grep -r "EXPO_PUBLIC_ADMIN_API_KEY" src/
grep -r "ADMIN_API_KEY" src/
```

## Step 2 — Replace with Clerk JWT in each file

### Before (insecure)
```ts
headers: {
  Authorization: `Bearer ${process.env.EXPO_PUBLIC_ADMIN_API_KEY}`
}
```

### After (secure)
```ts
const { getToken } = useAuth()
const token = await getToken()
headers: {
  Authorization: `Bearer ${token}`
}
```

## Step 3 — Update cosmix-admin API routes

Any route that validates against the shared key must switch to Clerk JWT:

```ts
// Before — accepts shared secret
if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_API_KEY}`) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

// After — validates Clerk JWT
import { checkAdminAccess } from '@/lib/admin-access'
const { user } = await checkAdminAccess(req)
// throws 401 automatically if invalid
```

## Step 4 — Remove the key entirely

After replacing all usages:
- Remove `EXPO_PUBLIC_ADMIN_API_KEY` from `cosmix-v2/.env`
- Remove `ADMIN_API_KEY` from `cosmix-admin/.env`
- Remove from Vercel environment variables
- Remove from `config/constants.ts` in cosmix-v2

## Rules
- Do NOT remove the key until ALL usages are replaced — do it atomically
- Test every affected API call after the change
- `getToken()` is async — always await it
- If a screen uses the key outside a React component (e.g. in an action file),
  pass the token as a parameter instead of calling useAuth() directly
- Public routes (`/api/public/*`) need no auth — don't add auth to those
