# Admin Screen: Catalog (Categories + Services)

**Repo:** `cosmix-v2`
**File:** `src/app/(admin)/catalog.tsx`

## This is the most complex admin screen
Admin manages the global service catalog that ALL providers pick from.
Structure: Category → Parent Service → Sub-services (with workTypes)

## API Calls
```
GET    /api/admin/categories                        — list all global categories
POST   /api/admin/categories                        — create category
PATCH  /api/admin/categories/[categoryId]           — edit category
DELETE /api/admin/categories/[categoryId]           — delete (blocked if has services)

GET    /api/admin/services                          — full tree with relations
POST   /api/admin/services                          — create parent or sub-service
PATCH  /api/admin/services/[serviceId]              — edit (name, description, workTypes only)
DELETE /api/admin/services/[serviceId]              — delete (blocked if has sub-services or bookings)
```

## Data shapes

### Category
```ts
{
  id: string,
  name: string,
  popular: boolean,
  isGlobal: true
}
// POST/PATCH body: { name: string, popular?: boolean }
```

### Service (full tree from GET)
```ts
{
  id, name, description, categoryId, parentServiceId, workTypes,
  category: { name, isGlobal },
  parentService: { id, name } | null,
  subServices: [{ id, name }]
}
```

### POST service — parent
```ts
{ name: string, categoryId: string, description?: string }
```

### POST service — sub-service
```ts
{
  name: string,
  categoryId: string,       // must match parent's category
  parentServiceId: string,
  description?: string,
  workTypes?: Array<'UUDET'|'POISTO'|'HUOLTO'|'EI_LISAKKEITA'|'LYHYET'|'KESKIPITKAT'|'PITKAT'>
}
```

### PATCH service — only these fields changeable
```ts
{ name?: string, description?: string, workTypes?: string[] }
// Cannot change categoryId or parentServiceId after creation
```

## UI Structure
```
Top: Category pills (horizontal scroll)
  [+ New Category] pill at end
  Each pill: category name, tap to filter services below
  Long press pill → edit/delete category

Below: Services tree filtered by selected category
  Parent service row [+ Add Sub] [Edit] [Delete]
    └─ Sub-service row [Edit] [Delete]
    └─ Sub-service row
  [+ Add Parent Service] button at bottom
```

## Category form (Modal/BottomSheet)
```
Name: TextInput (required, unique)
Popular: Toggle switch
[Save] [Cancel]
```

## Service form (Modal/BottomSheet)
```
Mode: Parent Service / Sub-service (toggle, only shown for new)

If Parent:
  Name (required)
  Category (dropdown — from categories list)
  Description (multiline, optional)

If Sub-service:
  Name (required)
  Category (auto-filled from parent, read-only)
  Parent Service (dropdown — filtered by category)
  Description (optional)
  Work Types (multi-select chips):
    UUDET | POISTO | HUOLTO | EI_LISAKKEITA | LYHYET | KESKIPITKAT | PITKAT

[Save] [Cancel]
```

## Delete rules (enforce API constraints)
- Category delete blocked if it has services → show Alert: "Remove all services in this category first"
- Service delete blocked if it has sub-services → show Alert: "Remove sub-services first"
- Service delete blocked if it has bookings → show Alert: "This service has existing bookings and cannot be deleted"
- These are API-enforced (400 response) — handle the error and show the right message

## Rules
- Fetch categories and services in parallel on mount
- After any create/edit/delete, refetch both lists to stay in sync
- workTypes are only meaningful on sub-services — hide the field for parent services
- PATCH cannot change categoryId or parentServiceId — don't show those fields in edit mode
- Show sub-service count badge on each parent service row
- Pull to refresh
