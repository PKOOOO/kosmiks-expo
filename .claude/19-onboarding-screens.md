# Phase 3: Provider Onboarding Screens (Phase 1 + 2)

**Repo:** `cosmix-v2`

## Navigator: `src/app/(onboarding)/_layout.tsx`

```tsx
// No tabs — linear flow, no back navigation between phases
import { Stack } from 'expo-router'

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="phase1" />
      <Stack.Screen name="phase2" />
      <Stack.Screen name="phase3" />
      <Stack.Screen name="pending" />
      <Stack.Screen name="rejected" />
    </Stack>
  )
}
```

## Update `admin-webview.tsx` navigator logic

Add onboarding routing based on providerStatus:

```ts
const statusRoutes = {
  'NOT_APPLIED':      '/(onboarding)/phase1',
  'PHASE1_PENDING':   '/(onboarding)/pending',
  'PHASE1_APPROVED':  '/(onboarding)/phase2',
  'PHASE2_PENDING':   '/(onboarding)/pending',
  'PHASE2_APPROVED':  '/(onboarding)/phase3',
  'PHASE3_PENDING':   '/(onboarding)/pending',
  'ACTIVE':           '/(provider)/bookings',
  'REJECTED':         '/(onboarding)/rejected',
}

// providerStatus comes from GET /api/admin/check response
// Add providerStatus to the checkAdminStatus response
// (update /api/admin/check to include user.providerStatus)
```

---

## `src/app/(onboarding)/phase1.tsx`

### Title: "Become a service provider"
### Subtitle: "Tell us about yourself"
### Progress: Step 1 of 3

### Form fields
```
ABOUT YOU section:
  First name* (TextInput)
  Last name*  (TextInput)
  Email       (pre-filled from Clerk, read-only)
  Phone*      (TextInput, +358 prefix shown)

LOCATION section:
  City* (dropdown: Helsinki, Espoo, Tampere, Vantaa, 
         Turku, Oulu, Jyväskylä, other Finnish cities)
  Neighbourhood/area (TextInput, optional)
  Home address* (TextInput, "not shown publicly" note)

SERVICES section:
  "What services will you offer?"
  Multi-select chips from GET /api/public/categories:
    e.g. [Kynnet] [Ripset] [Hieronnat] [Hiukset] ...
  At least 1 required
```

### Submit
```ts
// POST /api/provider/apply/phase1
// On success → router.replace('/(onboarding)/pending')
```

### Rules
- Email pre-filled from Clerk useUser() — not editable
- Phone field shows +358 prefix (Finnish number)
- City is a picker/dropdown not free text
- Service categories fetched from GET /api/public/categories
- All * fields required — validate before submit
- Match beige/brown theme

---

## `src/app/(onboarding)/phase2.tsx`

### Title: "Contract & verification"
### Progress: Step 2 of 3

### Multi-step within Phase 2 (use internal step state, not navigation)

```
Internal steps:
  Step 1/4: Personal details
  Step 2/4: Business details  
  Step 3/4: Document upload
  Step 4/4: Terms + Stripe Connect
```

### Step 1 — Personal details
```
PERSONAL INFORMATION:
  Full legal name* (TextInput)
  Date of birth*   (TextInput DD/MM/YYYY or date picker)
  Finnish ID*      (TextInput XXXXXX-XXXX — Henkilötunnus)
  Nationality*     (dropdown, default Finnish)
```

### Step 2 — Business details
```
BUSINESS INFORMATION:
  Business/trading name* (TextInput)
  Y-tunnus               (TextInput 0000000-0, optional)
  Business type*         (dropdown: Sole trader / Ltd / Partnership / Other)
```

### Step 3 — Document upload
```
DOCUMENTS:
  "Upload a photo of your ID and any business certificates"
  
  Upload button → calls expo-image-picker → 
    POST /api/upload → stores Cloudinary URL
  
  Show uploaded docs as thumbnail grid
  Allow multiple uploads (up to 5)
  At least 1 document required
  
  Each thumbnail has an X button to remove
```

### Step 4 — Terms + Stripe
```
TERMS & CONDITIONS:
  ScrollView showing terms text
  Checkbox: "I agree to the Servey terms and conditions"
  
PAYOUT SETUP:
  "Set up your bank account to receive payments"
  Stripe Connect button (same as existing payouts.tsx)
  Shows green "Connected" if already set up
  Required before submitting
  
[Submit application] button
  → POST /api/provider/apply/phase2
  → router.replace('/(onboarding)/pending')
```

---

## `src/app/(onboarding)/pending.tsx`

```
Large centered icon (clock/hourglass)
Title: "Application under review"
Body: "We'll review your application and get back to 
       you within 2–3 business days."

Show which phase is pending:
  PHASE1_PENDING → "We're reviewing your expression of interest"
  PHASE2_PENDING → "We're verifying your documents and contract"
  PHASE3_PENDING → "We're reviewing your service listings"

[Sign out] button at bottom
```

Note: This screen polls GET /api/provider/apply/status every 30 seconds.
If status changes (admin approved), automatically navigate to next phase.

---

## `src/app/(onboarding)/rejected.tsx`

```
Large centered icon (X / warning)
Title: "Application not approved"
Body: Shows rejectedReason from the application

"If you believe this is a mistake, contact us at 
 support@servey.fi"

[Sign out] button
```

---

## Rules
- No back button between phases — linear flow only
- Within Phase 2, allow back between internal steps
- Document upload requires at least 1 file before proceeding to Step 4
- Stripe Connect in Phase 2 Step 4 uses existing payouts logic
- Polling on pending screen — stop polling when component unmounts
- Never allow a provider to re-submit a phase that's already approved
