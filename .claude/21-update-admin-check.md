# Phase 3: Update /api/admin/check to include providerStatus

**Repo:** `cosmix-admin`
**File:** `app/api/admin/check/route.ts`

## Why
The navigator in admin-webview.tsx reads providerStatus to route
providers to the correct onboarding phase. Currently /api/admin/check
only returns { isAdmin, hasSaloons, user }.

## Add providerStatus to response

```ts
// Current response
{
  isAdmin: boolean,
  hasSaloons: boolean,
  user: { id, name, email }
}

// Updated response
{
  isAdmin: boolean,
  hasSaloons: boolean,
  providerStatus: string,  // ProviderStatus enum value
  user: { id, name, email }
}
```

## Update the route

```ts
const dbUser = await prisma.user.findUnique({
  where: { clerkId: clerkUser.id },
  select: {
    id: true,
    name: true,
    email: true,
    isAdmin: true,
    providerStatus: true,  // ADD THIS
    saloons: { select: { id: true } }
  }
})

return Response.json({
  isAdmin: dbUser.isAdmin,
  hasSaloons: dbUser.saloons.length > 0,
  providerStatus: dbUser.providerStatus,  // ADD THIS
  user: { id: dbUser.id, name: dbUser.name, email: dbUser.email }
})
```

## Update navigator in cosmix-v2/src/app/admin-webview.tsx

```ts
const data = await res.json()
// data now includes providerStatus

if (data.isAdmin) {
  setUserRole('admin')
  return
}

// Route provider based on providerStatus
const statusRoutes: Record<string, string> = {
  'NOT_APPLIED':     '/(onboarding)/phase1',
  'PHASE1_PENDING':  '/(onboarding)/pending',
  'PHASE1_APPROVED': '/(onboarding)/phase2',
  'PHASE2_PENDING':  '/(onboarding)/pending',
  'PHASE2_APPROVED': '/(onboarding)/phase3',
  'PHASE3_PENDING':  '/(onboarding)/pending',
  'ACTIVE':          '/(provider)/bookings',
  'REJECTED':        '/(onboarding)/rejected',
}

const route = statusRoutes[data.providerStatus] ?? '/(onboarding)/phase1'
router.replace(route)
```

## Rules
- Admin users bypass providerStatus check entirely
- Customer users (hasSaloons false, not admin, status NOT_APPLIED) 
  go to customer stack as before
- Only users who have started provider onboarding get routed to 
  onboarding screens
- A pure customer account should never see onboarding screens
