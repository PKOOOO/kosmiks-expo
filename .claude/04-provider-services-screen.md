---
description: Native provider services screen — create, edit, delete services and pricing
globs: ["**/app/(provider)/services.tsx"]
alwaysApply: false
---

# Provider Screen: Services & Pricing

## File: `cosmix-v2/src/app/(provider)/services.tsx`

## API Calls
```
GET    /api/saloons/[id]/services                    — list services
POST   /api/saloons/[id]/services                    — create service
PUT    /api/saloons/[id]/services/[serviceId]        — update service
DELETE /api/saloons/[id]/services/[serviceId]        — delete service
```

Get `saloonId` from the logged-in provider's profile (fetched on mount).

## Auth Header
```ts
const { getToken } = useAuth()
const token = await getToken()
headers: { Authorization: `Bearer ${token}` }
```

## Service fields
```ts
type Service = {
  id: string
  name: string
  description: string
  price: number        // EUR, shown as €XX.XX
  durationMinutes: number
  categoryId: string
  isActive: boolean
}
```

## UI Structure
```
Header: "My Services"  [+ Add Service button]

<FlatList>
  <ServiceCard
    name="Manicure"
    duration="45 min"
    price="€35.00"
    actions: [Edit, Delete]
  />
</FlatList>

<BottomSheet> ← opens for Add and Edit
  <ServiceForm />
</BottomSheet>
```

## ServiceForm fields
- Name (TextInput, required)
- Description (TextInput multiline)
- Price in EUR (numeric input, required)
- Duration in minutes (numeric picker: 15, 30, 45, 60, 90, 120)
- Category (dropdown from GET /api/public/categories)
- Active toggle

## Delete confirmation
Show an Alert before deleting:
`Alert.alert('Delete Service', 'Are you sure?', [Cancel, Delete])`

## Rules
- Price must be stored as float EUR (not cents) — the API handles conversion
- durationMinutes must always be set — surface it clearly (was missing from UI before)
- Use `react-native-bottom-sheet` or a Modal for the form
- Optimistic UI on delete — remove from list immediately, restore on error
- Match styling of existing screens in the app
