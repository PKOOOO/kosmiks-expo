# Phase 3: Admin Application Review

**Repo:** `cosmix-admin` + `cosmix-v2`

## Backend Routes

### `app/api/admin/applications/route.ts`
```ts
// GET — list all applications with user info, grouped by status
export async function GET(req: Request) {
  const { user } = await checkAdminAccess(req)
  if (!user.isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const applications = await prisma.providerApplication.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true, providerStatus: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return Response.json({ applications })
}
```

### `app/api/admin/applications/[id]/approve/route.ts`
```ts
// POST — approve an application, advance to next phase
export async function POST(req: Request) {
  const { user } = await checkAdminAccess(req)
  if (!user.isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const applicationId = req.url.split('/applications/')[1].split('/approve')[0]
  const body = await req.json()

  const application = await prisma.providerApplication.findUnique({
    where: { id: applicationId },
    include: { user: true }
  })

  if (!application) return Response.json({ error: 'Not found' }, { status: 404 })

  // Determine next status based on current phase
  const nextStatus = {
    1: 'PHASE1_APPROVED',
    2: 'PHASE2_APPROVED',
    3: 'ACTIVE',
  }[application.currentPhase]

  await prisma.user.update({
    where: { id: application.userId },
    data: { providerStatus: nextStatus as any }
  })

  await prisma.providerApplication.update({
    where: { id: applicationId },
    data: { adminNotes: body.notes ?? null }
  })

  // If Phase 3 approved → create Saloon record if not exists
  if (application.currentPhase === 3) {
    const existingSaloon = await prisma.saloon.findFirst({
      where: { userId: application.userId }
    })

    if (!existingSaloon) {
      await prisma.saloon.create({
        data: {
          name: application.businessName ?? application.firstName + ' ' + application.lastName,
          userId: application.userId,
          address: application.address,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    }
  }

  return Response.json({ success: true, nextStatus })
}
```

### `app/api/admin/applications/[id]/reject/route.ts`
```ts
// POST — reject application with reason
// Body: { reason: string }
export async function POST(req: Request) {
  const { user } = await checkAdminAccess(req)
  if (!user.isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const applicationId = req.url.split('/applications/')[1].split('/reject')[0]
  const { reason } = await req.json()

  if (!reason) return Response.json({ error: 'Rejection reason required' }, { status: 400 })

  const application = await prisma.providerApplication.findUnique({
    where: { id: applicationId }
  })

  await prisma.user.update({
    where: { id: application!.userId },
    data: { providerStatus: 'REJECTED' }
  })

  await prisma.providerApplication.update({
    where: { id: applicationId },
    data: { rejectedReason: reason }
  })

  return Response.json({ success: true })
}
```

---

## Frontend — Admin Applications Tab

**File:** `src/app/(admin)/applications.tsx`

### Add to admin navigator `_layout.tsx`
```tsx
<Tabs.Screen
  name="applications"
  options={{
    title: 'Applications',
    tabBarIcon: ({ color }) => <Ionicons name="clipboard" color={color} size={24} />,
    tabBarBadge: pendingCount || undefined  // show count of pending apps
  }}
/>
```

### UI Structure
```
Header: "Provider Applications"

Filter tabs: All | Phase 1 | Phase 2 | Phase 3 | Rejected

FlatList of ApplicationCards
  Each card shows:
    - Applicant name + email
    - Phase badge: "Phase 1" | "Phase 2" | "Phase 3"
    - Status badge: pending (yellow) | approved (green) | rejected (red)
    - Submitted date
    - Tap → expands to full detail view

Expanded detail view per phase:
  Phase 1: name, phone, city, neighbourhood, address, service categories
  Phase 2: legal name, DOB, Finnish ID, business details, 
           document images (tappable to view full size),
           terms accepted timestamp
  Phase 3: list of services they've added with prices

Action buttons (only for pending):
  [Approve] (green) — shows notes input first
  [Reject]  (red)   — requires rejection reason input
```

### Approve flow
```ts
const handleApprove = async (applicationId: string) => {
  Alert.prompt(
    'Add notes (optional)',
    'These notes are for internal use only',
    async (notes) => {
      await fetch(`${API_URL}/api/admin/applications/${applicationId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      })
      refetch()
    }
  )
}
```

### Reject flow
```ts
const handleReject = async (applicationId: string) => {
  Alert.prompt(
    'Rejection reason (required)',
    'This will be shown to the applicant',
    async (reason) => {
      if (!reason) return
      await fetch(`${API_URL}/api/admin/applications/${applicationId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      refetch()
    }
  )
}
```

## Rules
- Only show Approve/Reject buttons for PENDING applications
- Document images must be viewable full screen (use Modal + Image)
- Badge count on tab shows total pending across all phases
- Refetch after every approve/reject action
- Alert.prompt is iOS only — on Android use a TextInput Modal instead
