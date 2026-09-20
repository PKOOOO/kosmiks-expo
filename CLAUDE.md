# Servey — Full Project Context

> Handoff document. Paste at the start of a new chat to restore context.
> Last updated: 25 August 2026 — supersedes all earlier versions.

---

## ⚠️ 0. Verify this document before trusting it

**This was written from a conversation, not from reading the codebase.** It reflects what was reported during a long working session, so it may contain misremembered details, omissions, or things that were true mid-session but changed by the end.

**Recommended first task in a new session:** have Claude Code read both repos and check this document against reality. Ask it to report every discrepancy rather than silently correcting.

### Known gaps and uncertainties

**Not captured:**
- **Current file structure.** A directory tree was deliberately omitted — a lot was deleted this session and the post-deletion layout wasn't re-read. Regenerate from the repo.
- **The active test account.** A fresh email was used for the final verification but isn't recorded here. This matters for the `cleanup-test-data.ts` keep-list (§11).
- **New users seen in the database:** `Peter Lagat` (`lagatpetr@gmail.com`) and `piusdev67@gmail.com` appeared during testing. Their purpose and whether they should be kept is undocumented.
- **Support email domain.** Earlier docs flagged verifying ownership of `servey.fi` / `servey.com`. Now that `kosmiks.com` is the live domain, whether support addresses should move there is **unresolved**.
- **UI redesign specifics** for `salon.tsx` and `payouts.tsx` were compressed out of this version.

**Possibly wrong:**
- The admin dashboard is described as 5 native tabs. An earlier version said 4. Not verified.
- The precise boundary between what is deployed and what is only local at time of writing.

**Verified with reasonable confidence:** the identity/auth model (§5), the alias removal (§6), payment verification behaviour (§7), and push notification status (§8) — these were each confirmed by runtime testing during the session.

---

## 1. Project Overview

**Servey** (formerly **Cosmix** — that brand is fully dead) is a Finnish spa/salon booking marketplace.

| Component | Description |
|---|---|
| `cosmix-v2` | Expo / React Native mobile app — **this is the entire product UI** |
| `cosmix-admin` | Next.js **API-only** backend on Vercel |
| Database | Neon PostgreSQL via Prisma |
| Auth | Clerk (mobile SDK + `@clerk/backend` `verifyToken` server-side) |
| Payments | Stripe — customer checkout only, no Stripe Connect |
| Images | Cloudinary |
| Maps | **Mapbox GL JS inside a WebView** — `react-native-maps` is NOT installed |
| Email | Resend |
| Push | Expo Notifications + Firebase Cloud Messaging (FCM V1) |

The repo *directories* are still named `cosmix-v2` / `cosmix-admin`. Only the product was renamed.

### ⚠️ Architecture correction (August 2026)

Earlier documentation — including `CLAUDE.md`, which is **still stale** — described an architecture where the admin and provider dashboards rendered as Next.js web pages inside a WebView. **That is no longer true.**

Reality:
- **All admin and provider UI is native React Native**, under `(admin)/` and `(provider)/` in `cosmix-v2`
- `admin-webview.tsx` contains **no WebView**. It is a role router: it calls `/api/admin/check` and `router.replace()`s to a native screen. The filename is a leftover.
- The only WebViews in the app render inline Mapbox HTML (`map.tsx`, `saloons.tsx`, `AddressMapPicker.tsx`) — none load a remote URL
- The Next.js web tier has been **deleted** (see §6). Only `/api/*`, a placeholder `/`, `/public/[category]`, and two Stripe callbacks remain

This misconception cost hours of debugging. Don't trust `CLAUDE.md` on architecture.

---

## 2. User Roles

1. **Customer** — books services
2. **Provider** — offers services, native 5-tab dashboard
3. **Admin** — manages platform, native 5-tab dashboard (Overview, Saloons, Catalog, Applications, Users)

Roles come from **database columns**, not from Clerk:
- `isAdmin` — boolean on the user row
- `providerStatus` — enum advanced through onboarding

Clerk handles authentication only. Authorization is entirely yours.

---

## 3. Provider Onboarding — 3 Phases

```
NOT_APPLIED → PHASE1_PENDING → PHASE1_APPROVED →
PHASE2_PENDING → PHASE2_APPROVED → PHASE3_PENDING → ACTIVE
```

**Phase 1 — Expression of Interest (8 steps):** First name → Last name → Phone → City → Neighbourhood → Address → Service categories → Transport mode

**Phase 2 — Verification (6 steps):** Legal full name → IBAN (`FI## #### #### #### ##`) → Bank account holder → Date of birth (18+) → Qualification documents (up to 3) → Terms & Submit

**Phase 3 — Salon Setup (step-by-step, not a single form):** Salon name → Short intro → Description → **Mapbox map location picker** → Opening hours (7 days) → Photos (required, up to 6)

On Phase 3 submit → status becomes **ACTIVE** immediately, no admin review.

---

## 4. Payout Model

- Manual SEPA bank transfers every Friday
- Stripe Connect removed entirely
- IBAN collected in Phase 2
- **10% platform fee**

---

## 5. How Identity Actually Works

The most important section. Read before touching any auth code.

**There is no Clerk webhook in play.** Both webhook handlers exist but are unreachable — middleware blocks them (Clerk authenticates with `svix` headers, which the gate doesn't recognise). One is explicitly disabled in code; the other is active but does an unconditional `user.create` that would throw duplicate-key errors. `CLERK_WEBHOOK_SECRET` isn't set in dev. **Leave them alone.**

**Users are created on demand.** A request arrives carrying a Clerk JWT in the `X-User-Token` header. `verifyToken` (from `@clerk/backend` — real, never stubbed) verifies it, then `getOrCreateUserFromClerk()` looks up or creates the database row.

**Key helpers in `lib/admin-access.ts`:**
- `checkAdminAccess()` — resolves `{ isAdmin, user }`. It is a *resolver*, not an admin gate. `requireAdmin()` is the gate.
- `getEndUser()` — wraps `checkAdminAccess()` and returns null when the resolved user is the synthetic service user. **Use this for user-scoped routes.**

**Never use `auth()` from `@clerk/nextjs`.** All call sites have been removed. It has no session in this architecture and would return null or throw.

---

## 6. The `fake-clerk` Alias — RESOLVED

**What it was:** `tsconfig.json` aliased `@clerk/nextjs` → `lib/fake-clerk`, so every `auth()` call in 39 files resolved to a stub returning the same hardcoded identity (`"service-admin"`) for every request. The server could not distinguish users.

**What it caused:** `/api/checkout` trusted `auth()` and created a user row with the synthetic clerkId and a real customer's email. Every booking in the database attached to that one row — `Booking.userId` was meaningless platform-wide. That row's email collision then made `getOrCreateUserFromClerk` return null for the real owner, 401ing every authenticated request from that account.

**How it was fixed:** the Next.js dashboard turned out to be entirely dead code — unreachable behind a deliberate 403 middleware wall, superseded by native screens. So instead of a multi-day Clerk-in-WebView integration, it became a deletion job:
- Deleted `app/dashboard/`, `app/admin/`, `app/(root)/`, `/sign-up`, `/reset-password`, `/post-sign-in`, plus orphaned components, actions, and hooks
- Removed `<ClerkProvider>` from `app/layout.tsx`
- Deleted the alias from `tsconfig.json` and `lib/fake-clerk.tsx`
- Removed both remaining `auth()` call sites
- `WebhookEvent` now imports from `@clerk/backend` (it was never exported by `@clerk/nextjs` — only the stub's `any` made it compile)

`@clerk/nextjs` now has zero source importers. Still in `package.json` — safe to uninstall.

**Notable find:** `/reset-password` was a reachable Finnish-language page that accepted any code, told users "Salasana vaihdettu!" and did nothing. Deleted.

---

## 7. Payment Verification — HARDENED

**The hole:** the checkout PATCH handler confirmed arbitrary booking IDs with no ownership check and ignored `paymentIntentId` entirely. Anyone with the bearer key — which ships extractable in the APK — could flip bookings to `confirmed` without paying.

**Now implemented:**

| Step | Behaviour |
|---|---|
| 1 | `paymentIntentId` required → 400 |
| 2 | Bookings loaded via `findMany` first → 404 if any missing |
| 3 | Stripe status must be `succeeded` or `processing` → else 402 |
| 4 | Every booking's `paymentIntentId` column must equal the presented id → else 403 |
| 5 | `getEndUser()` mismatch **logged only**, never blocks |
| 6 | Atomic `updateMany` on `pending` only — retries idempotent, no duplicate emails or pushes |

**Design decisions worth preserving:**
- **Accept `processing`, not just `succeeded`** — `automatic_payment_methods` is enabled and some methods settle asynchronously. Rejecting `processing` would strand those customers.
- **Fail open on Stripe *transport* errors, fail closed on *definitive* rejections.** Network error or 5xx → allow through (a paid customer must never be stranded by an API blip). `StripeInvalidRequestError` or 4xx — Stripe saying "no such intent" — → 402. A blanket fail-open would reopen the whole hole, since `retrieve("pi_forged")` *throws*.
- **`paymentIntentId` is a column on `Booking`**, not Stripe metadata. Metadata caps at 500 chars, which truncated past ~13 services and would have falsely rejected large orders.
- Legacy bookings (null `paymentIntentId`) fall back to the metadata check, then allow with a warning.

**Client messaging** (`CheckoutButton.tsx`) distinguishes 402 / 403 / 404 / network, includes the payment reference (`Maksutunnus: pi_…`), and offers retry where safe — with copy stating retrying won't double-charge.

Checkout logging no longer contains PII (previously logged name, email, phone on every request).

---

## 8. Push Notifications

### ✅ Working and verified end-to-end on real Android devices

**Infrastructure:**
- `pushToken String?` on the `User` model
- `POST /api/user/push-token` — uses `getEndUser()`, rejects bearer-key-only callers
- `lib/send-notification.ts` — `sendPushNotification(token, title, body, data?)`, never throws
- `PushNotificationRegistrar` in `src/app/_layout.tsx` — registers on sign-in
- Debug logs stripped; error logging retained without sensitive values

**Live notifications:**

| ID | Trigger | Recipient | Message |
|---|---|---|---|
| C1 | Payment confirmed | Customer | `Booking Confirmed ✓` |
| P7 | Payment confirmed | Provider | `New Booking 🎉` |

Date format: `Mon 2 Jun at 14:00` (en-GB, 24h).

### 🐛 Two bugs fixed — both worth remembering

**1. Hardcoded projectId.** `getExpoPushTokenAsync({ projectId })` used a literal from an abandoned Expo account. Standalone builds validate this and **throw**; the error was swallowed. Now read dynamically:
```ts
import Constants from "expo-constants";
const EXPO_PUSH_PROJECT_ID =
  Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
```

**2. The 401.** Token registration worked perfectly but the POST returned 401, so tokens never saved. The DB kept serving ghost tokens from devices that no longer existed, and every notification died at FCM with `DeviceNotRegistered`. Root cause was the corrupted user row (§6).

### Diagnostic technique that actually worked

```bash
# 1. Send
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{"to":"ExponentPushToken[REAL_TOKEN]","title":"Test","body":"Test"}'

# 2. Fetch the receipt with the returned id — THIS is where the truth is
curl -X POST https://exp.host/--/api/v2/push/getReceipts \
  -H "Content-Type: application/json" \
  -d '{"ids":["THE_ACTUAL_ID"]}'
```

`"status":"ok"` on **send** only means Expo queued it. The **receipt** tells you whether FCM delivered. Send ok + receipt `DeviceNotRegistered` = dead token.

`send-notification.ts` does **not** check receipts, so dead tokens accumulate silently forever. Worth adding.

### ⏳ Not yet implemented

**Provider:** P1 Phase 1 received · P2 Phase 1 approved · P3 Phase 2 received · P4 Phase 2 approved · P5 Phase 3 / activated · P6 rejected (with reason) · P8 new review · P9 payout processed *(needs webhook)*

**Admin:** A1 new Phase 1 application · A2 new Phase 2 documents · A3 Phase 3 setup submitted

**Customer:** C2 cancelled by provider · C3 status updated by admin · C4 appointment reminder *(needs cron)*

Suggested order: P2/P4/P5/P6 → A1/A2/A3 → P8 → C2/C3 → P9/C4

---

## 9. Infrastructure

### Expo / EAS
- **Account:** `kpkk` (previously `maxkoo`, then `gabbyk` — both abandoned)
- **Project:** `@kpkk/servey`, projectId `e001f7f4-9117-4d83-b0d6-21bbe8b84511`
- **Never hardcode the projectId** — it has drifted three times

### Firebase
- Project `servey-5eee1`, Android package `com.servey.app`
- `google-services.json` in `cosmix-v2` root
- FCM V1 service account key uploaded to EAS (development + preview) ✅
- Preview keystore SHA-1: `2C:83:DA:B1:80:85:23:D6:B6:31:A3:17:60:AC:C7:28:17:18:D5:E5`

### Domain
- **`kosmiks.com`** purchased by client on GoDaddy, live on Vercel with SSL
- **Use `https://www.kosmiks.com`** — the apex returns a **308 redirect** to `www`, and a redirect on an authenticated POST risks dropping the body or `Authorization` header
- All app URLs migrated. Old Vercel origins remain in the CORS allow-list so already-installed APKs keep working

### Build commands
```bash
eas build --profile preview --platform android      # standalone APK for testing
eas build --profile development --platform android  # dev client
eas build --profile production --platform android   # Play Store
```

---

## 10. Rebrand — COMPLETED

| Field | Old | New |
|---|---|---|
| App name | Cosmix | **Servey** |
| Slug / scheme | cosmix | **servey** |
| Android package | com.cosmix.beauty | **com.servey.app** |
| iOS bundle ID | com.cosmix.beauty | **com.servey.app** |
| Stripe merchantIdentifier | merchant.com.cosmix.beauty | **merchant.com.servey.app** |

**Deliberately unchanged** (would break state or data): AsyncStorage key `@cosmix_dismissed_rating_bookings`, localStorage key `cosmix_has_saloons`, Cloudinary folder `cosmix/provider-documents`, synthetic admin emails `@cosmix.local`, repo directory names.

Changing the package name after Play Store submission is **impossible** — `com.servey.app` is locked in.

---

## 11. Database

- **No real Prisma migration history.** Use `npx prisma db push`. **Never `prisma migrate dev`** — it detects drift and offers to reset, which would wipe production. A fake baseline sits at `prisma/migrations/20240101000000_init`.
- **⚠️ Local `.env` points at the production database.** There is no dev database. Every `db push`, script, and Prisma Studio edit hits the live system. Neon supports cheap DB branching — worth setting up before real users exist.
- Before any `db push`, run `prisma migrate diff --from-schema-datasource --to-schema-datamodel --script` and confirm the output is only what you intend.
- A cleanup script exists at `scripts/cleanup-test-data.ts` — **untracked**, dry-run by default, `--execute` to run. **Update `KEEP_EMAILS` before running** or it deletes accounts you want.

---

## 12. Environment Variables

### `cosmix-admin` (Vercel)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   # not set — no longer needed, web tier is API-only
CLERK_SECRET_KEY=sk_test_...        # instance: ideal-lacewing-71
DATABASE_URL=...                    # Neon — PRODUCTION
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISH_KEY=pk_test_...   # NOTE: "PUBLISH" not "PUBLISHABLE" — typo, code matches
ADMIN_EMAIL=admin@cosmix.local      # must stay synthetic, never a real user's address
CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET
```

### `cosmix-v2` (.env + eas.json)
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_aWRlYWwtbGFjZXdpbmctNzEu...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_PRODUCTION_DOMAIN=https://www.kosmiks.com
EXPO_PUBLIC_ADMIN_DASHBOARD_URL=https://www.kosmiks.com
```

**Both must be in `eas.json`, not just `.env`.** `.env` is gitignored and **not read by EAS builds** — `EXPO_PUBLIC_ADMIN_DASHBOARD_URL` was missing from `eas.json` for a long time, so every shipped APK fell back to `http://localhost:3000` and the admin role check hit the device itself.

Env vars are **baked in at build time** — `.env` changes require a rebuild.

---

## 13. TODO — Outstanding Work

### 🔴 Security
- [ ] **Bearer-key `isAdmin` fallback** (`admin-access.ts` ~131-136). `EXPO_PUBLIC_ADMIN_API_KEY` ships extractable inside the APK, and presenting it alone resolves to the service user **with `isAdmin: true`** on some routes. `/api/checkout` and `/api/bookings` deliberately depend on this fallback for anonymous checkout, so it can't simply be removed — needs separating "anonymous customer may book" from "caller is admin".
- [ ] Consider whether a client-side shared key is the right model at all before launch

### 🟠 Correctness
- [ ] **One token per user.** `pushToken` is a single column, but tokens identify a *device install*. Two devices → the second overwrites the first and the first silently stops receiving. Needs a `PushToken` table keyed by device, many-to-one against user. Caused hours of confusion during debugging.
- [ ] **Push receipt checking.** `send-notification.ts` never fetches receipts, so `DeviceNotRegistered` is invisible and dead tokens persist forever.
- [ ] **Data repair** — `piis40060@gmail.com` still sits on a row whose `clerkId` is `service-admin`, so that account still 401s. Simplest fix is to let the cleanup script delete it.

### 🟡 Housekeeping
- [ ] **Update `CLAUDE.md`** — still describes the WebView architecture, marks eleven capabilities "WebView Only", and calls `admin-webview.tsx` a WebView wrapper. All wrong.
- [ ] Update `scripts/cleanup-test-data.ts` keep-list; commit it (currently untracked)
- [ ] Set up a Neon dev branch so local work stops hitting production
- [ ] Uninstall `@clerk/nextjs` — zero importers remain
- [ ] Decide what `/` should serve. Currently a static "Servey" placeholder; the client will eventually visit their own domain
- [ ] Likely-orphaned, not yet deleted: `components/settings/stripe-connect.tsx`, `hooks/billing/`, `components/main-nav.tsx`, `components/mobile-bottom-nav.tsx`, `components/loader.tsx`
- [ ] Replace the mock salon fallback in `map.tsx` (fake Helsinki pins) with an empty state

### 🔵 Blocked on client
- [ ] **Apple Developer account — $99/year.** Blocks all iOS testing, App Store submission, APNs push, and the Apple Pay merchant cert.
- [ ] **GoDaddy mailboxes** — "Professional Email Pro Light" $1.99/mailbox/mo for `support@kosmiks.com` + `admin@kosmiks.com`. Domain is on the client's account, so they must purchase.
- [ ] Resend sending domain — `notify.kosmiks.com` recommended (SPF, DKIM, DMARC)
- [ ] Hosting plan — Vercel Hobby prohibits commercial use. Pro is $20/mo flat; recommended over Railway's metered $5 credit for predictability.

---

## 14. Gotchas — read before debugging anything

1. **Expo Go cannot receive push notifications** (SDK 53+). This app is on SDK 57. **All push testing must use an EAS build.** Mixing Expo Go and APK testing produces different tokens for the same account, each overwriting the last — this caused hours of phantom-chasing.
2. **A green build does not mean working code.** Three separate failures compiled cleanly and only broke at runtime — including `/` returning 500 after `<ClerkProvider>` was removed. Run the production server and hit the routes.
3. **Grep with both quote styles.** An audit missed three importers because it searched `from "@clerk/nextjs"` with double quotes only.
4. **Push receipts, not send responses.** `send` returning `ok` means queued, not delivered.
5. **Never hardcode the Expo projectId.**
6. **Don't run `prisma migrate dev`.** Use `db push`, and check the diff first.
7. **The app uses Mapbox in a WebView**, not `react-native-maps`.
8. **`NEXT_PUBLIC_STRIPE_PUBLISH_KEY` is misspelled** in Vercel. Code matches the typo — don't fix one without the other.
9. **`ADMIN_EMAIL` must never be a real user's address** — `ensureServiceUser()` would claim their row.
10. **Notification and email failures must never break the booking flow** — all calls wrapped and run after the success path is determined.
11. **Filenames lie.** `admin-webview.tsx` has no WebView. `salon-access.ts` had zero callers. Verify before assuming.
