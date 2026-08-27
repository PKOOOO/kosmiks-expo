---
description: Native provider bookings screen — view and manage customer bookings
globs: ["**/app/(provider)/bookings.tsx"]
alwaysApply: false
---

# Provider Screen: Bookings

## File: `cosmix-v2/src/app/(provider)/bookings.tsx`

## API Calls
```
GET  /api/bookings          — fetch all bookings for provider's salon
PUT  /api/bookings/[id]     — update booking status (confirm / cancel)
```

## Auth Header
```ts
const { getToken } = useAuth()
const token = await getToken()
headers: { Authorization: `Bearer ${token}` }
```

## Data to display per booking
- Customer name + phone
- Service name
- Date and time (formatted, Finnish locale: fi-FI)
- Duration in minutes
- Price in EUR
- Status badge: `pending` (yellow) | `confirmed` (green) | `cancelled` (red)

## UI Structure
```
<ScrollView refreshControl={<RefreshControl />}>
  <SectionList
    sections={[
      { title: 'Upcoming', data: upcomingBookings },
      { title: 'Past', data: pastBookings },
    ]}
    renderItem={<BookingCard />}
  />
</ScrollView>
```

## BookingCard Actions
- `pending` bookings: show "Confirm" and "Cancel" buttons
- `confirmed` bookings: show "Cancel" button only
- `past` bookings: no actions

## Status update
```ts
await fetch(`/api/bookings/${bookingId}`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'confirmed' }) // or 'cancelled'
})
```

## States
- Loading skeleton while fetching
- Empty state: "No bookings yet" with icon
- Error state with retry button
- Pull to refresh

## Rules
- Sort upcoming by date ASC, past by date DESC
- Do not show customer contact info for cancelled bookings
- Match styling of existing `src/app/bookings.tsx` (customer version)
