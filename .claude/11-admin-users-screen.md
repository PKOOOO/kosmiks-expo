# Admin Screen: Users

**Repo:** `cosmix-v2`
**File:** `src/app/(admin)/users.tsx`

## API Call
```
GET /api/admin/users   — all users on the platform
```

## Important
Before building, ask Claude Code to confirm the exact response shape
of GET /api/admin/users — it was not fully documented in the audit.
Run this first:
  "Show me the full response shape of GET /api/admin/users
   including all fields returned per user"

## Expected shape (verify before using)
```ts
[
  {
    id: string,
    name: string,
    email: string,
    createdAt: string,
    isAdmin: boolean,
    // possibly: bookings count, saloon ownership
  }
]
```

## UI Structure
```
Header: "All Users" + total count badge

SearchBar — filter by name or email client-side

FlatList of UserCards
  Each card:
    - Name + email
    - Role badge: Admin (red) | Provider (blue) | Customer (grey)
    - Joined date
    - Tap → expand to show booking history if available in response
```

## No user management actions
There is no API to promote, suspend, or delete users from admin routes.
Do not show any action buttons. This screen is read-only.
Note at bottom: "User management via Clerk dashboard"

## Rules
- isAdmin: true → role badge "Admin"
- hasSaloons or owns a saloon → role badge "Provider"  
- otherwise → role badge "Customer"
- Sort default: newest first (createdAt desc)
- Add sort toggle: Newest | A-Z
- Pull to refresh
- Empty state if no users
- Confirm actual API response shape before implementing
