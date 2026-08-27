# Admin Screen: Overview

**Repo:** `cosmix-v2`
**File:** `src/app/(admin)/overview.tsx`

## API Calls
```
GET /api/admin/stats    — platform totals
GET /api/admin/revenue  — per-saloon revenue breakdown
```

## Auth
```ts
const { getToken } = useAuth()
const token = await getToken()
headers: { Authorization: `Bearer ${token}` }
```

## Stats response shape
```ts
{
  globalCategories: number,
  parentServices: number,
  totalSaloons: number,
  totalEnrolledServices: number,
  totalRevenue: number  // EUR float
}
```

## Revenue response shape
```ts
{
  grandTotal: number,
  saloons: [
    {
      id: string,
      name: string,
      ownerName: string,
      ownerEmail: string,
      totalRevenue: number,
      bookingsCount: number,
      bookings: [{ totalAmount, status, bookingTime, customerName, service, user }]
    }
  ]
}
```

## UI Structure
```
ScrollView
  Section: Platform Stats (2x2 grid of stat cards)
    - Total Revenue: €{totalRevenue}
    - Total Saloons: {totalSaloons}
    - Total Services: {totalEnrolledServices}
    - Categories: {globalCategories}

  Section: Revenue by Saloon
    - Sorted by revenue descending (API already sorts this)
    - Each row: saloon name | owner name | €revenue | booking count
    - Tappable → expands to show recent bookings list inline

  Section: Monthly Breakdown (compute client-side)
    - Group revenue.saloons[].bookings by month (bookingTime field)
    - Show as a simple bar or list: "March 2025 — €1,240"
    - Note: filter out cancelled bookings for meaningful revenue figure
```

## Stat Card component
```tsx
<StatCard
  label="Total Revenue"
  value={`€${stats.totalRevenue.toFixed(2)}`}
  icon="cash"
/>
```

## Rules
- Fetch both endpoints in parallel: `Promise.all([fetchStats(), fetchRevenue()])`
- Monthly breakdown: group by `bookingTime.slice(0, 7)` (YYYY-MM)
- For monthly revenue, exclude bookings with `status === 'cancelled'`
- Format all EUR amounts as `€X,XXX.XX` with thousands separator
- Pull to refresh both endpoints together
- Loading skeleton for stat cards while fetching
- grandTotal from revenue endpoint is the authoritative revenue figure
