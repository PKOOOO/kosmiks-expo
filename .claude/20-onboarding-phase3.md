# Phase 3: Provider Onboarding — Phase 3 Service Listing

**Repo:** `cosmix-v2`
**File:** `src/app/(onboarding)/phase3.tsx`

## Context
Provider has been approved through Phase 1 + 2.
Now they need to add at least one service before going live.
This screen reuses the same service CRUD logic from 
`src/app/(provider)/services.tsx` but in onboarding context.

## Important — Saloon must exist first
When admin approves Phase 2, the backend creates a Saloon record
(see 18-admin-applications.md). Phase 3 screen needs the saloon id.

On mount, fetch saloon:
```ts
const res = await fetch(`${API_URL}/api/saloons`, {
  headers: { Authorization: `Bearer ${token}` }
})
const { saloons } = await res.json()
const saloonId = saloons[0]?.id
```

If no saloon exists yet (race condition), show loading state.

---

## UI Structure

```
Title: "Add your services"
Subtitle: "Add at least one service to go live"
Progress: Step 3 of 3

[+ Add Service] button → opens same modal as services.tsx

List of added services (same ServiceCard as services.tsx)
  Each card: name, duration, price, delete button

Bottom:
  {services.length === 0 && 
    <Text>Add at least one service to continue</Text>}
  
  [Submit for review] button
    → disabled if services.length === 0
    → calls POST /api/provider/apply/phase3
    → on success: router.replace('/(onboarding)/pending')
```

## Reuse from services.tsx
- ServiceCard component
- Add/edit modal with category picker + service selector
- Same API calls: POST/PUT/DELETE /api/saloons/[id]/services

## Rules
- At least 1 service required before submit button activates
- Submitted services are real SaloonService records — 
  they go live when admin approves Phase 3
- Show a note: "Your services will be visible to customers 
  after admin approval"
- Match beige/brown theme
- No tab bar — this is onboarding flow, use Stack navigation
