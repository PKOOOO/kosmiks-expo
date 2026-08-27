# Admin Screen: Saloons

**Repo:** `cosmix-v2`
**File:** `src/app/(admin)/saloons.tsx`

## API Calls
```
GET /api/admin/saloons   — all saloons with provider info + counts
GET /api/admin/revenue   — for revenue per saloon (merge client-side)
```

## Important
`GET /api/admin/saloons` does NOT return revenue.
`GET /api/admin/revenue` does NOT return image/review counts.
Fetch both and merge by saloon `id` client-side.

## Saloon item shape (merged)
```ts
{
  id: string,
  name: string,
  address: string | null,
  createdAt: string,
  user: { name: string, email: string },   // provider
  _count: { images: number, bookings: number, reviews: number },
  totalRevenue: number,     // from /api/admin/revenue, default 0 if not found
  bookingsCount: number,    // from /api/admin/revenue for accuracy
}
```

## UI Structure
```
Header: "All Saloons" + total count badge

SearchBar — filter by saloon name or provider name client-side

FlatList of SalonCards
  Each card shows:
    - Salon name (bold)
    - Provider: {user.name} ({user.email})
    - Address
    - Stats row: 📅 {bookingsCount} bookings | ⭐ {reviews} reviews | €{totalRevenue}
    - Joined: {createdAt formatted}

  Tap card → expand inline to show:
    - Full booking list from revenue.saloons[].bookings
    - Each booking: customer, service, date, amount, status badge
```

## No suspend/activate
There is no suspend endpoint. Do not show any suspend/activate button.
If admin needs to remove a saloon, note it as "managed via web dashboard".

## Rules
- Fetch both endpoints in parallel with Promise.all
- Merge by id: `revenueMap[saloon.id]?.totalRevenue ?? 0`
- Search filters on both `name` and `user.name` and `user.email`
- Sort default: by totalRevenue descending
- Add a sort toggle: Revenue ↓ | Bookings ↓ | Newest
- Pull to refresh
- Empty state if no saloons exist yet
