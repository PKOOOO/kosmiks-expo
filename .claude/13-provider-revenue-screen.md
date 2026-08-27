# Phase 2: Provider Revenue Screen

**Repo:** `cosmix-v2`
**File:** `src/app/(provider)/revenue.tsx`

**Repo:** `cosmix-admin`
**New route:** `app/api/provider/revenue/route.ts`

## Problem
Providers can't see their own earnings.
`GET /api/admin/revenue` exists but is admin-only.
Need a provider-scoped version.

---

## Backend first — `cosmix-admin`

### New route: `app/api/provider/revenue/route.ts`

```ts
// Auth: Clerk JWT, provider only (not admin required)
// Returns revenue only for the logged-in provider's saloon

export async function GET(req: Request) {
  const { user } = await checkAdminAccess(req) // reuse existing auth
  
  const saloon = await prisma.saloon.findFirst({
    where: { userId: user.id },
    select: { id: true, name: true }
  })

  if (!saloon) {
    return Response.json({ error: 'No saloon found' }, { status: 404 })
  }

  const bookings = await prisma.booking.findMany({
    where: { saloonId: saloon.id },
    orderBy: { bookingTime: 'desc' },
    select: {
      id: true,
      totalAmount: true,
      status: true,
      bookingTime: true,
      customerName: true,
      service: { select: { name: true } },
      user: { select: { name: true, email: true } }
    }
  })

  const confirmedBookings = bookings.filter(b => b.status !== 'cancelled')
  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + b.totalAmount, 0)

  return Response.json({
    saloon: { id: saloon.id, name: saloon.name },
    totalRevenue,
    bookingsCount: confirmedBookings.length,
    bookings  // all bookings including cancelled, client filters
  })
}
```

---

## Frontend — `cosmix-v2`

### File: `src/app/(provider)/revenue.tsx`

### API Call
```
GET /api/provider/revenue
Authorization: Bearer <clerk_token>
```

### UI Structure
```
ScrollView
  Header card (dark brown):
    Total Revenue: €{totalRevenue}
    Confirmed bookings: {bookingsCount}

  Section: Monthly Breakdown
    Group bookings by month client-side (bookingTime.slice(0,7))
    Exclude cancelled bookings from revenue totals
    Show: "April 2025 — €1,240 (8 bookings)"

  Section: Recent Bookings
    FlatList of booking rows:
      - Customer name
      - Service name
      - Date + time (fi-FI locale)
      - Amount: €{totalAmount}
      - Status badge: confirmed (green) | pending (yellow) | cancelled (red)
```

### Monthly grouping (client-side)
```ts
const groupByMonth = (bookings) => {
  return bookings.reduce((acc, booking) => {
    const month = booking.bookingTime.slice(0, 7) // "2025-04"
    if (!acc[month]) acc[month] = { revenue: 0, count: 0 }
    if (booking.status !== 'cancelled') {
      acc[month].revenue += booking.totalAmount
      acc[month].count++
    }
    return acc
  }, {})
}
```

## Add to provider navigator

In `src/app/(provider)/_layout.tsx`, add a 5th tab:
```tsx
<Tabs.Screen
  name="revenue"
  options={{
    title: 'Revenue',
    tabBarIcon: ({ color }) => <Ionicons name="trending-up" color={color} size={24} />
  }}
/>
```

## Rules
- Only count `status !== 'cancelled'` bookings in revenue totals
- Show all bookings in the list including cancelled (with red badge)
- Format amounts as `€X,XXX.XX`
- Sort months newest first
- Pull to refresh
- Loading skeleton while fetching
