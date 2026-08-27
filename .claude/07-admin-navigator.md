# Admin Navigator

**Repo:** `cosmix-v2`
**File:** `src/app/(admin)/_layout.tsx`

## 4 Tabs
```
Overview | Saloons | Catalog | Users
```

## Create `src/app/(admin)/_layout.tsx`
```tsx
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function AdminLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="overview"
        options={{
          title: 'Overview',
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart" color={color} size={24} />
        }}
      />
      <Tabs.Screen
        name="saloons"
        options={{
          title: 'Saloons',
          tabBarIcon: ({ color }) => <Ionicons name="business" color={color} size={24} />
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Catalog',
          tabBarIcon: ({ color }) => <Ionicons name="list" color={color} size={24} />
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color }) => <Ionicons name="people" color={color} size={24} />
        }}
      />
    </Tabs>
  )
}
```

## Files to create
```
src/app/(admin)/
├── _layout.tsx     ← this file
├── overview.tsx    ← stats + revenue
├── saloons.tsx     ← all providers
├── catalog.tsx     ← categories + services CRUD
└── users.tsx       ← all customers
```

## Rules
- Match the same beige/brown theme used in `(provider)/_layout.tsx`
- Admin tab navigator must be completely separate from provider tabs
- No WebView anywhere in the admin stack
