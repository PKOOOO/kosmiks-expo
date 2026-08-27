# Phase 3: Prisma Schema — Provider Onboarding

**Repo:** `cosmix-admin`
**File:** `prisma/schema.prisma`

## Step 1 — Add providerStatus enum to User model

Add this enum to the schema:
```prisma
enum ProviderStatus {
  NOT_APPLIED
  PHASE1_PENDING
  PHASE1_APPROVED
  PHASE2_PENDING
  PHASE2_APPROVED
  PHASE3_PENDING
  ACTIVE
  REJECTED
}
```

Add field to User model:
```prisma
model User {
  // ... existing fields ...
  providerStatus  ProviderStatus  @default(NOT_APPLIED)
  application     ProviderApplication?
}
```

## Step 2 — Add ProviderApplication model

```prisma
model ProviderApplication {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])

  // Phase 1 — Expression of Interest
  firstName          String?
  lastName           String?
  phone              String?
  city               String?
  neighbourhood      String?
  address            String?
  serviceCategories  String[]  // array of category names they want to offer

  // Phase 2 — Contract & Verification
  legalName          String?
  dateOfBirth        String?   // DD/MM/YYYY
  finnishId          String?   // Henkilötunnus XXXXXX-XXXX
  nationality        String?
  businessName       String?
  yTunnus            String?   // Finnish business reg number 0000000-0
  businessType       String?
  documentUrls       String[]  // Cloudinary URLs of uploaded docs
  termsAccepted      Boolean   @default(false)
  termsAcceptedAt    DateTime?
  stripeConnected    Boolean   @default(false)

  // Phase 3 — Service Listing
  // Services are submitted as SaloonService records linked to the provider's saloon
  // No extra fields needed here — Phase 3 just checks saloon has at least 1 service

  // Admin fields
  adminNotes         String?
  rejectedReason     String?
  currentPhase       Int       @default(1)  // 1, 2, or 3

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Step 3 — Run migrations

```bash
npx prisma migrate dev --name add_provider_onboarding
npx prisma generate
```

## Step 4 — Seed existing admin user as ACTIVE

After migration, manually update the admin user so they aren't blocked:
```sql
UPDATE "User" SET "providerStatus" = 'ACTIVE' WHERE "isAdmin" = true;
```

Or via Prisma studio:
```bash
npx prisma studio
```

## Rules
- Never use raw strings for providerStatus — always use the enum
- documentUrls is an array of strings — Cloudinary secure_urls
- serviceCategories in Phase 1 is just names for admin to review — 
  actual SaloonService records are created in Phase 3
- The application record is created when provider submits Phase 1
- Do not delete the application on rejection — keep for audit trail
