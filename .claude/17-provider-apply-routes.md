# Phase 3: Provider Application API Routes

**Repo:** `cosmix-admin`

## Routes to create

```
GET  /api/provider/apply/status          — get current application status
POST /api/provider/apply/phase1          — submit Phase 1
POST /api/provider/apply/phase2          — submit Phase 2
POST /api/provider/apply/phase3          — submit Phase 3 (triggers final review)
```

---

## `app/api/provider/apply/status/route.ts`

```ts
// Returns current providerStatus + application data for the logged-in user
export async function GET(req: Request) {
  const { user } = await checkAdminAccess(req)

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      providerStatus: true,
      application: true,
    }
  })

  return Response.json({
    status: dbUser?.providerStatus ?? 'NOT_APPLIED',
    application: dbUser?.application ?? null,
  })
}
```

---

## `app/api/provider/apply/phase1/route.ts`

```ts
// Body:
// {
//   firstName: string,
//   lastName: string,
//   phone: string,
//   city: string,
//   neighbourhood?: string,
//   address: string,
//   serviceCategories: string[]  // e.g. ["Kynnet", "Hieronta"]
// }

export async function POST(req: Request) {
  const { user } = await checkAdminAccess(req)
  const body = await req.json()

  // Validate required fields
  const { firstName, lastName, phone, city, address, serviceCategories } = body
  if (!firstName || !lastName || !phone || !city || !address || !serviceCategories?.length) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Upsert application
  const application = await prisma.providerApplication.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      firstName, lastName, phone, city,
      neighbourhood: body.neighbourhood,
      address, serviceCategories,
      currentPhase: 1,
    },
    update: {
      firstName, lastName, phone, city,
      neighbourhood: body.neighbourhood,
      address, serviceCategories,
    }
  })

  // Update user status
  await prisma.user.update({
    where: { id: user.id },
    data: { providerStatus: 'PHASE1_PENDING' }
  })

  return Response.json({ success: true, application })
}
```

---

## `app/api/provider/apply/phase2/route.ts`

```ts
// Body:
// {
//   legalName: string,
//   dateOfBirth: string,     // DD/MM/YYYY
//   finnishId: string,       // XXXXXX-XXXX
//   nationality: string,
//   businessName: string,
//   yTunnus?: string,        // 0000000-0
//   businessType: string,
//   documentUrls: string[],  // Cloudinary URLs from /api/upload
//   termsAccepted: boolean,
// }

export async function POST(req: Request) {
  const { user } = await checkAdminAccess(req)
  const body = await req.json()

  const { legalName, dateOfBirth, finnishId, nationality,
          businessName, businessType, documentUrls, termsAccepted } = body

  if (!legalName || !dateOfBirth || !finnishId || !nationality ||
      !businessName || !businessType || !documentUrls?.length || !termsAccepted) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  await prisma.providerApplication.update({
    where: { userId: user.id },
    data: {
      legalName, dateOfBirth, finnishId, nationality,
      businessName, yTunnus: body.yTunnus,
      businessType, documentUrls,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      currentPhase: 2,
    }
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { providerStatus: 'PHASE2_PENDING' }
  })

  return Response.json({ success: true })
}
```

---

## `app/api/provider/apply/phase3/route.ts`

```ts
// Phase 3 — provider has added their services via the existing
// POST /api/saloons/[id]/services route.
// This route just marks them as ready for final admin review.

export async function POST(req: Request) {
  const { user } = await checkAdminAccess(req)

  // Verify they have at least 1 service
  const saloon = await prisma.saloon.findFirst({
    where: { userId: user.id },
    include: { _count: { select: { saloonServices: true } } }
  })

  if (!saloon || saloon._count.saloonServices === 0) {
    return Response.json(
      { error: 'Add at least one service before submitting' },
      { status: 400 }
    )
  }

  await prisma.providerApplication.update({
    where: { userId: user.id },
    data: { currentPhase: 3 }
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { providerStatus: 'PHASE3_PENDING' }
  })

  return Response.json({ success: true })
}
```

---

## Rules
- All routes use `checkAdminAccess()` for auth — same pattern as everywhere else
- Phase 2 can only be submitted if providerStatus is PHASE1_APPROVED — validate this
- Phase 3 can only be submitted if providerStatus is PHASE2_APPROVED — validate this
- Never allow skipping phases
- `termsAcceptedAt` must be set to `new Date()` server-side, not trusted from client
