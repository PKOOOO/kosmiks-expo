# Kosmiks — Full Project Context

> Handoff document. Paste at the start of a new chat to restore context.
> Last updated: 23 October 2026 (rebrand to Kosmiks + Clerk production instance) — supersedes all earlier versions.
> `AGENTS.md` is a copy of this file — keep the two identical.

---

## ⚠️ 0. Verify this document before trusting it

**This was written from working sessions, not from a full read of the codebase.** It may contain misremembered details or things that changed afterwards.

**Recommended first task in a new session:** have Claude Code read both repos and check this document against reality. Report every discrepancy rather than silently correcting.

### Known gaps and uncertainties

**Not captured:**
- **Current file structure.** Regenerate from the repo.
- **The active test accounts.** Matters for the `cleanup-test-data.ts` keep-list (§11). `Peter Lagat` (`lagatpetr@gmail.com`) and `piusdev67@gmail.com` appeared during earlier testing; purpose undocumented.
- **UI redesign specifics** for `salon.tsx` and `payouts.tsx` were compressed out.

**Possibly wrong:**
- The admin dashboard is described as 5 native tabs. Not re-verified.

**Verified with reasonable confidence (by runtime testing):** the identity/auth model (§5), the alias removal (§6), payment verification (§7), push notifications on the Kosmiks build (§8), Clerk production sign-in and the user re-link (§5a).

---

## 1. Project Overview

**Kosmiks** (formerly **Servey**, before that **Cosmix** — both names are dead in the product) is a Finnish spa/salon booking marketplace.

| Component | Description |
|---|---|
| `cosmix-v2` | Expo / React Native mobile app — **this is the entire product UI** |
| `cosmix-admin` | Next.js **API-only** backend on Vercel (plus `/`, `/privacy`, `/public/[category]`) |
| Database | Neon PostgreSQL via Prisma |
| Auth | Clerk **production instance** on `kosmiks.com` (mobile SDK + `@clerk/backend` `verifyToken` server-side) — see §5a |
| Payments | Stripe — customer checkout only, no Stripe Connect. **Still in test mode.** |
| Images & files | **Cloudflare R2** — see §9 Storage |
| Maps | **Mapbox GL JS inside a WebView** — `react-native-maps` is NOT installed |
| Email | Resend |
| Push | Expo Notifications + Firebase Cloud Messaging (FCM V1) |

The repo *directories* are still named `cosmix-v2` / `cosmix-admin`, and the Expo slug / EAS project is still `servey` (see §9). Only user-visible branding was renamed.

### Architecture note

- **All admin and provider UI is native React Native**, under `(admin)/` and `(provider)/` in `cosmix-v2`. There is no web dashboard.
- `admin-webview.tsx` contains **no WebView**. It is a role router: it calls `/api/admin/check` and `router.replace()`s to a native screen. The filename is a leftover.
- The only WebViews render inline Mapbox HTML (`map.tsx`, `saloons.tsx`, `AddressMapPicker.tsx`) — none load a remote URL.
- The Next.js web tier was deleted (§6). Remaining pages: `/` (Kosmiks placeholder linking to `/privacy`), `/privacy` (privacy policy — **must stay public**, Google's OAuth consent screen links to it), `/public/[category]`, and two Stripe callbacks.

---

## 2. User Roles

1. **Customer** — books services
2. **Provider** — offers services, native 5-tab dashboard
3. **Admin** — manages platform, native dashboard (Overview, Saloons, Catalog, Applications, Users)

Roles come from **database columns**, not from Clerk:
- `isAdmin` — boolean on the user row
- `providerStatus` — enum advanced through onboarding

Clerk handles authentication only. Authorization is entirely ours.

---

## 3. Provider Onboarding — 3 Phases

```
NOT_APPLIED → PHASE1_PENDING → PHASE1_APPROVED →
PHASE2_PENDING → PHASE2_APPROVED → PHASE3_PENDING → ACTIVE
```

**Phase 1 — Expression of Interest (8 steps):** First name → Last name → Phone → City → Neighbourhood → Address → Service categories → Transport mode

**Phase 2 — Verification (6 steps):** Legal full name → IBAN (`FI## #### #### #### ##`) → Bank account holder → Date of birth (18+) → Qualification documents (up to 3) → Terms & Submit

**Phase 3 — Salon Setup (step-by-step):** Salon name → Short intro → Description → **Mapbox map location picker** → Opening hours (7 days) → Photos (required, up to 6)

On Phase 3 submit → status becomes **ACTIVE** immediately, no admin review.

---

## 4. Payout Model

- Manual SEPA bank transfers every Friday
- Stripe Connect removed entirely
- IBAN collected in Phase 2
- **10% platform fee**

---

## 5. How Identity Actually Works

Read before touching any auth code.

**There is no Clerk webhook in play.** Both webhook handlers exist but are unreachable — middleware blocks them (Clerk authenticates with `svix` headers, which the gate doesn't recognise). One is disabled in code; the other does an unconditional `user.create` that would throw duplicate-key errors. **Leave them alone.**

**Users are created on demand.** A request arrives carrying a Clerk JWT in the `X-User-Token` header. `verifyToken` (from `@clerk/backend` — real, never stubbed) verifies it against `CLERK_SECRET_KEY`, then `getOrCreateUserFromClerk()` (`lib/get-or-create-user.ts`) looks up or creates the database row.

**Key helpers in `lib/admin-access.ts`:**
- `checkAdminAccess()` — resolves `{ isAdmin, user }`. It is a *resolver*, not an admin gate. `requireAdmin()` is the gate.
- `getEndUser()` — wraps `checkAdminAccess()` and returns null when the resolved user is the synthetic service user. **Use this for user-scoped routes.**

**Never use `auth()` from `@clerk/nextjs`.** All call sites have been removed.

**All relations key on `User.id` (UUID), never on `clerkId`.** Bookings, salons, reviews, applications and payouts reference `User.id`, so changing a row's `clerkId` carries all its data with it.

### 5a. Clerk production instance & user re-link (Oct 2026)

| | |
|---|---|
| Clerk app | `cosmix` — `app_3EJ4lKHuAAwia9kQPn8n81E32V1` |
| Production instance | `ins_3L5vso8bNlwyOqDpK5xci7NNdzf`, domain **`kosmiks.com`** (primary), Frontend API `clerk.kosmiks.com` |
| Development instance | `ideal-lacewing-71` (`pk_test_…`) — **no longer used.** The backend verifies with `sk_live`, so dev-instance tokens get 401. Local `.env` and all build profiles use `pk_live` since 24 Oct 2026. |
| Social logins (prod) | **Google: custom credentials** (see §9 Google Cloud). **Apple: disabled** until the Apple Developer account exists. |
| Native redirect allowlist (prod) | `kosmiks://oauth-native-callback` — **required**. Production rejects any redirect URL not on the list; dev accepts anything. |
| Sign-up requirements | Identical to dev (no phone/username/legal-consent requirements). |

Clerk users are **not** copied between instances — every user got a new Clerk ID in production. **`getOrCreateUserFromClerk()` re-links by verified email:** if no row has the incoming `clerkId` but a row has the same email *and* Clerk reports that email as `verified`, the row's `clerkId` is moved to the new ID. It never re-keys the synthetic `service-admin` row. This also fixes guest-checkout rows (`clerkId: temp_…` with a real email) that previously 401'd when the guest later signed in.

Verified on 23 Oct 2026: a provider account signed in on the Kosmiks build and kept its row (created 2026-09-23), `ACTIVE` status, salon, booking, and got a new push token.

**Secret keys:** a production instance can have several secret keys; any of them works. The backend uses one created on 23 Oct 2026 (stored in Vercel). The original auto-created key was never used — delete it (§13).

---

## 6. The `fake-clerk` Alias — RESOLVED

**What it was:** `tsconfig.json` aliased `@clerk/nextjs` → `lib/fake-clerk`, so every `auth()` call resolved to a stub returning the same hardcoded identity (`"service-admin"`). The server could not distinguish users.

**What it caused:** `/api/checkout` created a user row with the synthetic clerkId and a real customer's email. Every booking attached to that one row. That row's email collision then made `getOrCreateUserFromClerk` return null for the real owner, 401ing every request from that account.

**How it was fixed:** the Next.js dashboard was dead code, so it was deleted (`app/dashboard/`, `app/admin/`, `app/(root)/`, `/sign-up`, `/reset-password`, `/post-sign-in`, orphaned components), `<ClerkProvider>` removed, the alias and `lib/fake-clerk.tsx` deleted, both remaining `auth()` call sites removed. `WebhookEvent` now imports from `@clerk/backend`.

`@clerk/nextjs` has zero source importers. Still in `package.json` — safe to uninstall.

---

## 7. Payment Verification — HARDENED

**The hole:** the checkout PATCH handler confirmed arbitrary booking IDs with no ownership check and ignored `paymentIntentId`. Anyone with the bearer key (extractable from the APK) could confirm bookings without paying.

| Step | Behaviour |
|---|---|
| 1 | `paymentIntentId` required → 400 |
| 2 | Bookings loaded via `findMany` first → 404 if any missing |
| 3 | Stripe status must be `succeeded` or `processing` → else 402 |
| 4 | Every booking's `paymentIntentId` column must equal the presented id → else 403 |
| 5 | `getEndUser()` mismatch **logged only**, never blocks |
| 6 | Atomic `updateMany` on `pending` only — retries idempotent |

**Design decisions worth preserving:**
- **Accept `processing`**, not just `succeeded` — some `automatic_payment_methods` settle asynchronously.
- **Fail open on Stripe *transport* errors, fail closed on *definitive* rejections** (`StripeInvalidRequestError` / 4xx → 402).
- **`paymentIntentId` is a column on `Booking`**, not Stripe metadata (metadata caps at 500 chars).
- Legacy bookings (null `paymentIntentId`) fall back to the metadata check, then allow with a warning.

**Client messaging** (`CheckoutButton.tsx`) distinguishes 402 / 403 / 404 / network, shows the payment reference (`Maksutunnus: pi_…`), and offers retry where safe. Checkout logging contains no PII.

---

## 8. Push Notifications

### ✅ Working — verified on the Kosmiks build (`com.kosmiks.app`), 23 Oct 2026

Test push to a re-linked account: send `ok`, **receipt `ok`**, notification shown on device.

**Infrastructure:**
- `pushToken String?` on the `User` model
- `POST /api/user/push-token` — uses `getEndUser()`, rejects bearer-key-only callers
- `lib/send-notification.ts` — `sendPushNotification(token, title, body, data?)`, never throws
- `PushNotificationRegistrar` in `src/app/_layout.tsx` — registers on sign-in
- projectId read dynamically:
```ts
import Constants from "expo-constants";
const EXPO_PUSH_PROJECT_ID =
  Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
```

**Live notifications** (`lib/send-notification.ts`: `sendPushNotification`, `notifyAdmins`, `notifyUser(userId, …)` which skips the service user, `formatWhen()` for "Mon 2 Jun at 14:00"):

| ID | Trigger | Recipient | Where |
|---|---|---|---|
| P1 / A1 | Phase 1 submitted | Provider / admins | `provider/apply/phase1` |
| P3 / A2 | Phase 2 submitted | Provider / admins | `provider/apply/phase2` |
| P5 / A3 | Phase 3 done — salon live | Provider / admins | `provider/apply/phase3` |
| P2 / P4 | Phase 1 / 2 approved | Provider | `admin/applications/[id]/approve` |
| P6 | Application rejected (with reason) | Provider | `admin/applications/[id]/reject` |
| C1 / P7 | Payment confirmed | Customer / provider | `checkout` (verified end-to-end 26 Oct 2026) |
| P8 | New review | Provider | `reviews` POST (added 26 Oct 2026) |
| C2 | Provider cancels a booking | Customer | `provider/bookings/[bookingId]` PUT (added 26 Oct 2026) |
| C3 | Admin changes a booking's status | Customer | `bookings/[bookingId]` PATCH (added 26 Oct 2026) |
| P9 | Payout sent | Provider | `admin/payouts/[id]` |

Guest bookings are attached to the service user, so C2/C3 only reach customers who were signed in when they booked.

### Diagnostic technique

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

`"status":"ok"` on **send** only means Expo queued it. The **receipt** tells you whether FCM accepted it. Send ok + receipt `DeviceNotRegistered` = dead token. `send-notification.ts` does **not** check receipts.

### ⏳ Not yet implemented

- **C4** appointment reminder — needs a cron job.

---

## 8a. Networking, offline handling & images (Oct 2026)

**Rule: screens never render `error.message`.** It can contain things like `java.net.UnknownHostException`. Store the caught error (`useState<unknown>`) and render `<ErrorState error={…} onRetry={…} />`.

| Piece | File | What it does |
|---|---|---|
| `apiFetch` | `src/lib/api.ts` | `fetch` + 15 s timeout; retries GET/HEAD twice on network failure (never POST/PATCH — payments); network failures become `ApiError('offline' \| 'timeout')` |
| `ApiError.http(status)` | `src/lib/api.ts` | What actions throw for non-OK responses (401/403 → `auth`, 404 → `notFound`, 5xx → `server`) |
| `describeError` / `connectionProblemEn` | `src/lib/api.ts` | Finnish copy for customer screens / English copy for provider onboarding (returns null for non-connection errors so server validation messages still show) |
| `useIsOffline`, `useOnReconnect`, `isOfflineNow` | `src/lib/network.ts` | `@react-native-community/netinfo`. `isInternetReachable === null` counts as online (avoids a banner flash at startup) |
| `<OfflineBanner />` | `src/components/OfflineBanner.tsx` | Mounted once in `src/app/_layout.tsx`. "Ei internetyhteyttä" under the status bar; "Yhteys palautettu" for 2 s on reconnect. `pointerEvents="none"` |
| `<ErrorState />` | `src/components/ErrorState.tsx` | Icon + Finnish title/message + "Yritä uudelleen". Auto-retries on reconnect. If the device is online but the request couldn't connect, it calls `GET /api/public/health` and switches to "Palvelussa on tilapäinen häiriö" when our backend is down |
| `<RemoteImage />` | `src/components/RemoteImage.tsx` | `expo-image` with `cachePolicy="memory-disk"` (seen photos work offline) and a beige image-icon fallback on failure. Same props as `Image` (`source`, `style`, `resizeMode`, `onError`) plus NativeWind `className` via `cssInterop`. Use it for every remote image; bundled `require(...)` images can stay on `Image` |

- All `src/actions/*` go through `apiFetch` and throw `ApiError`.
- Screens using `ErrorState`: home categories, `categories.tsx`, `saloons.tsx`, `services.tsx`, `salon-sector.tsx`, search (`(tabs)/service.tsx` — popular + search results; "Ei löytynyt" only when data actually loaded), `MyBookings`, `ReviewsSection`. `map.tsx` keeps its own card but uses `describeError` + `useOnReconnect`.
- **Checkout** refuses to start offline (`isOfflineNow`), and the pre-payment failure alert says "Veloitusta ei tehty". Stripe's own payment-sheet messages (`UserFacingError`) are still shown as-is.
- **Onboarding uploads** (Phase 2 documents, Phase 3 photos) refuse to start offline.
- **Backend:** `GET /api/public/health` (`app/api/public/health/route.ts`, runs `SELECT 1`, `no-store`). `/api/public/categories` sends `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
- Fully converted (26 Oct 2026): the two crossfading salon slideshows (`services.tsx`, `salon-sector.tsx`) animate an `Animated.View` with a `RemoteImage` inside. Provider/admin screens (English) use `friendlyErrorEn(error, fallback)` from `src/lib/api.ts` — `adminRequest()` (`src/lib/admin-api.ts`) maps offline/timeout/401/403/404/5xx to friendly copy and keeps short server messages (e.g. "Rejection reason required"); `apiHeaders(userToken?)` builds app-key + user-token headers.
- **Phase 2 (not started):** TanStack Query + AsyncStorage persister so lists show the last loaded data offline.

## 8b. Map (Mapbox) — redesigned Oct 2026

**Main map (`src/app/(app)/map.tsx`)** — redesigned 29 Oct 2026, verified in Chrome against real salons:
- **Mapbox GL JS v3.32.0 + Mapbox Standard style** (`mapbox://styles/mapbox/standard`), loaded dynamically inside the WebView. GL JS v3 **requires WebGL2**; the page checks for it and falls back to **v2.15.0 + `streets-v12`** so the map never goes blank.
- Standard config (`config.basemap`): `lightPreset` from the device clock (night <5 / ≥21, dawn <8, day <17, dusk), re-applied every 10 min with `setConfigProperty`; `theme: 'faded'`; `showPointOfInterestLabels: false` (only Kosmiks salons stand out); `show3dObjects` + pitch 55 / bearing −17 on every iPhone (iOS caps `hardwareConcurrency`, so it can't be used there) and on Android only when `navigator.hardwareConcurrency > 4` (flat on weak phones); `colorBuildingSelect: '#423120'`.
- **Branded pins:** HTML markers (name pill, brown round head with the arch-K, tip); selected = larger + pulsing beige ring.
- **Selected building:** `queryRenderedFeatures([[x-45,y-45],[x+45,y+45]], { target: { featuresetId: 'buildings', importId: 'basemap' } })` around the pin, nearest footprint centre wins, then `setFeatureState(feature, { select: true })`. A salon's coordinate usually sits on the pavement, so an exact-point query misses. The ring is the fallback.
- **Messages:** WebView → app `mapReady` (app re-sends the current selection), `markerTap`; app → WebView `selectSalon`, `centerOnLocation`, `zoomToService`. iOS delivers on `window`, Android on `document` — the page listens on both.
- **Layout (29 Oct 2026):** search bar floats at the top of the map; cards sit at the bottom just above the Mapbox logo; camera padding `MAP_PAD = { top: 70, bottom: 300 }` keeps the selected salon between them.
- **Bottom cards** (swipe = select + fly + highlight): photo + count, name, rating ("Uusi" with no reviews), **open/closed** from the salon's opening hours (`getOpeningStatus()` in `src/lib/opening-hours.ts`, Finnish format "Avoinna nyt · sulkeutuu 18.00"), address, **Reittiohjeet** (native maps) and **Varaa** (→ `/services`). Card body opens the detail modal.
- **Backend:** `GET /api/public/saloons/map` returns `timeSlots` (opening hours) and reviewers' first names only.
- The Mapbox **Places API** (business details, busy times) was evaluated and **not used**: public preview, busyness only for North America/Western Europe, and providers already enter their own hours/photos.

**All three map pages share `src/lib/map-html.ts`** (29 Oct 2026): `MAPBOX_LOADER_JS` (WebGL2 check → v3.32.0 + Standard or v2.15.0 + `streets-v12`; defines `gl2`, `use3d`, `MAPBOX_STYLE`, `lightPreset()`, `loadMapbox(cb)`), `KOSMIKS_PIN_CSS` / `KOSMIKS_PIN_JS` (`makeKosmiksPin(name, small)`). Bump the GL JS version there, once.
- **Salon list mini map** (`saloons.tsx`): non-interactive, Standard + light preset + faded theme, POI labels off, pitch 45 on capable phones, small Kosmiks pins, `fitBounds` around all salons (pass `pitch` — `fitBounds` resets it).
- **Address picker** (`AddressMapPicker.tsx`, Phase 3 + provider salon screen): Standard, **always flat, `lightPreset: 'day'`, `show3dObjects: false`** for precise pinning; keeps its own green location pin. `window.setMarker/setMarkerLabel/setMarkerIcon` exist before the map loads (RN calls them on mount); an early `setMarker` is applied once ready.
- All three keep the **Mapbox logo + compact attribution** (they used to be hidden with CSS — Mapbox's terms require them).
- Verified in Chrome against real salons (3D, pins, building highlight, night preset, picker label/move).

## 9. Infrastructure

### Expo / EAS
- **Account:** `kpkk` (previously `maxkoo`, then `gabbyk` — both abandoned)
- **Project:** `@kpkk/servey`, projectId `e001f7f4-9117-4d83-b0d6-21bbe8b84511`
- **The slug deliberately stays `servey`.** Expo projects can't be renamed; a new slug means a new projectId, new keystore, re-uploaded FCM key and new push tokens. Users never see the slug.
- **Never hardcode the projectId** — it has drifted three times.
- **Android credentials for `com.kosmiks.app`** (EAS stores credentials per package):
  - Keystore "Build Credentials 4oC93rz4fB" (EAS-generated, 23 Oct 2026)
    SHA-1 `66:D5:D9:3A:C7:39:90:7D:46:70:B8:BC:6E:C0:81:5F:1F:EA:76:4D`
    SHA-256 `F4:A9:6C:4F:56:CE:17:1A:7B:F4:55:C7:37:4B:DC:13:69:2F:2A:28:38:5B:A5:5F:1C:CC:2B:98:27:AC:57:3D`
  - FCM V1: service account `firebase-adminsdk-fbsvc@servey-5eee1.iam.gserviceaccount.com` (same key the old package used)
- **Expo SDK 58**, React Native 0.88, `@stripe/stripe-react-native` 0.81.0. Release builds use **R8 minification** (template default since SDK 58: `android.enableMinifyInReleaseBuilds=true`).
- **`plugins/with-stripe-android-fixes.js`** (registered in `app.json`) is required for release builds: it disables release lint (Stripe's `compileOnly` push-provisioning lib pulls the unpublished `play-services-tapandpay`) and adds `-dontwarn com.stripe.android.pushProvisioning.**` for R8. Don't remove it while on Stripe ≥ 0.81.

### Firebase
- Project `servey-5eee1` (display name still "servey" — project IDs can't change; users never see it)
- Android apps:
  - **`com.kosmiks.app`** — App ID `1:234539763868:android:6a47a950241aa8b1de4559`, SHA-1 + SHA-256 of the EAS keystore above ✅ (current)
  - `com.servey.app` — old package, no longer built. Remove later (§13).
- `google-services.json` in `cosmix-v2` root contains clients for **both** packages.
- Firebase CLI: `npx -y firebase-tools@latest …` (logged in as `hardhaven4@gmail.com`).

### Google Cloud / Google Auth Platform (project `servey-5eee1`)
- **Consent screen ("Branding"):** app name **Kosmiks**, support + developer contact `hardhaven4@gmail.com`, home page `https://www.kosmiks.com`, privacy policy `https://www.kosmiks.com/privacy`, authorized domain `kosmiks.com`, no logo.
- **Audience:** External, **In production** (published 23 Oct 2026). Only basic scopes (`openid`, `email`, `profile`), so no Google verification was needed. Google shows "continue to **kosmiks.com**"; showing the name "Kosmiks" + a logo requires brand verification (optional, a few days).
- **OAuth client:** Web application "**Kosmiks Clerk production**", client ID `234539763868-3ohefh19c197noiphv7acakff10rgu2t.apps.googleusercontent.com`, redirect URI `https://clerk.kosmiks.com/v1/oauth_callback`. Its one enabled secret (ends `HViH`) is set in Clerk production. The downloaded JSON lives in `~/Desktop/kosmiks-secrets/` (never in the repo).
- The separate GCP project **`cosmix-expo`** (OAuth clients "Cosmix Web/iOS/Android") is **legacy and unused**.

### Domain & DNS
- **`kosmiks.com`** purchased by the client on GoDaddy (still the registrar), live on Vercel with SSL
- **DNS is on Cloudflare** (nameservers `devin` / `tori.ns.cloudflare.com`). Edit DNS in Cloudflare, not GoDaddy. Zone ID `1c429a45bd6c239aba403792492dc057`. A DNS-edit API token for this zone is at `~/.cloudflare-kosmiks-token`.
- Vercel records (`A kosmiks.com → 216.198.79.1`, `CNAME www → …vercel-dns-017.com`) must stay **DNS only (gray cloud)**.
- **Clerk records (all DNS only — proxying breaks Clerk verification):**

| Host | Target |
|---|---|
| `clerk.kosmiks.com` | `frontend-api.clerk.services` |
| `accounts.kosmiks.com` | `accounts.clerk.services` |
| `clkmail.kosmiks.com` | `mail.zl2bvjw49d3q.clerk.services` |
| `clk._domainkey.kosmiks.com` | `dkim1.zl2bvjw49d3q.clerk.services` |
| `clk2._domainkey.kosmiks.com` | `dkim2.zl2bvjw49d3q.clerk.services` |

- `media.kosmiks.com` → R2 (proxied). `_dmarc` TXT exists.
- **Use `https://www.kosmiks.com`** for API calls — the apex returns a **308 redirect** to `www`, which risks dropping POST bodies / auth headers.
- Old Vercel origins remain in the CORS allow-list so old APKs keep working.

### Storage — Cloudflare R2
Two buckets, one bucket-scoped API token (`servey-api`, Object Read & Write on both):

| Bucket | Contents | Access | Stored in DB as |
|---|---|---|---|
| `kosmiks` | Salon photos (`salon-images/<userId>/…`), static app images (`static/…`) | **Public** at `https://media.kosmiks.com` | Full URL |
| `kosmiks-documents` | Provider qualification documents (`provider-documents/<userId>/…`) | **Private** — no domain, no r2.dev | `r2-private:<key>` reference |

**Upload flow:** app → `POST /api/upload/presign` `{ kind, contentType, size }` → 5-minute presigned PUT → app uploads straight to R2 → app saves the returned `url`. Images only (jpeg/png/webp/heic), max 10 MB. Client helper: `src/lib/upload-image.ts` (`kind: 'document'` for private uploads). `POST /api/upload` (multipart) is kept only for APKs released before Oct 2026.

**Private documents:** `ProviderApplication.qualificationDocs` holds `r2-private:` references, **not URLs**. `GET /api/admin/applications` turns them into 30-minute signed links via `resolveDocumentUrl()` in `lib/r2.ts`. Phase 2 submit only accepts references under the caller's own prefix. Phase 2's preview uses the local file URI.

**Migration:** `scripts/migrate-cloudinary-to-r2.mjs` ran 6 Oct 2026: 4 salon photos + 9 documents moved, 0 failures.

### Build commands
```bash
eas build --profile preview --platform android      # standalone APK for testing
eas build --profile development --platform android  # dev client (JS from Metro reads pk_live from .env)
eas build --profile production --platform android   # Play Store
```

---

## 10. Rebrand history

| Field | Cosmix (original) | Servey | **Kosmiks (current, Oct 2026)** |
|---|---|---|---|
| App name | Cosmix | Servey | **Kosmiks** |
| Scheme | cosmix | servey | **kosmiks** |
| Android package | com.cosmix.beauty | com.servey.app | **com.kosmiks.app** |
| iOS bundle ID | com.cosmix.beauty | com.servey.app | **com.kosmiks.app** |
| Stripe merchantIdentifier | merchant.com.cosmix.beauty | merchant.com.servey.app | **merchant.com.kosmiks.app** |
| Expo slug | cosmix | servey | **servey (unchanged on purpose, §9)** |

`com.servey.app` was never submitted to Google Play, so changing the package was possible. **`com.kosmiks.app` becomes permanent the moment it is uploaded to the Play Store.** The new package installs as a separate app; testers must uninstall the old Servey APK (two installs on one account overwrite each other's push token).

**Deliberately unchanged** (would break state or data): AsyncStorage key `@cosmix_dismissed_rating_bookings`, localStorage key `cosmix_has_saloons`, synthetic admin emails `@cosmix.local`, repo directory names, Expo slug, Firebase project ID.

**Logo (Oct 2026):** a petal K cut out of an arch, dark brown `#423120`, wordmark KOSMIKS in Philosopher Bold with wide letter spacing. Client sheet: https://claude.ai/artifact/CshjguquQYaLK4KsTa7gbT. In the app: `assets/icon.png` (opaque), `assets/adaptive-icon.png`, `assets/splash.png`, `assets/notification-icon.png` (rendered by `.logo-design/render-icons.js`, git-excluded) and `<KosmiksLogo size wordmark color />` (`src/components/KosmiksLogo.tsx`, react-native-svg, K is a mask cut-out so it works on any background) used by `Header` (when the title is the brand) and `BrandHeader` (provider/admin dashboards). Still to export: Play Store icon 512×512 (before submission) and the 120×120 Google consent-screen logo (triggers Google brand verification).

**Apple sign-in** is hidden in `src/app/(app)/sign-in.tsx` behind `APPLE_SIGN_IN_ENABLED = false` (it is disabled on the Clerk production instance). App Store rule 4.8 requires it on iOS when Google sign-in is offered — enable it, **iOS only**, before the iOS launch. No Mac needed: Apple keys are created on developer.apple.com, iOS builds/submission run on EAS, testing needs an iPhone registered via `eas device:create`.

---

## 11. Database

- **No real Prisma migration history.** Use `npx prisma db push`. **Never `prisma migrate dev`** — it detects drift and offers to reset, which would wipe production. A fake baseline sits at `prisma/migrations/20240101000000_init`.
- **⚠️ Local `.env` points at the production database.** There is no dev database. Every `db push`, script, and Prisma Studio edit hits the live system.
- Before any `db push`, run `prisma migrate diff --from-schema-datasource --to-schema-datamodel --script` and confirm the output.
- A cleanup script exists at `scripts/cleanup-test-data.ts` — **untracked**, dry-run by default, `--execute` to run. **Update `KEEP_EMAILS` before running.**

---

## 12. Environment Variables

### `cosmix-admin` (Vercel)
```
CLERK_SECRET_KEY=sk_live_...        # Clerk PRODUCTION instance (kosmiks.com) since 23 Oct 2026
DATABASE_URL=...                    # Neon — PRODUCTION
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISH_KEY=pk_test_...   # NOTE: "PUBLISH" not "PUBLISHABLE" — typo, code matches
ADMIN_EMAIL=admin@cosmix.local      # must stay synthetic, never a real user's address
R2_ACCOUNT_ID=a929da41595f86d4bca91509a6c28997
R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY   # token "servey-api"
R2_PUBLIC_BUCKET=kosmiks
R2_PRIVATE_BUCKET=kosmiks-documents
R2_PUBLIC_URL=https://media.kosmiks.com
CRON_SECRET=...                     # Vercel sends it to cron routes; without it they 401
```
Env var changes on Vercel need a **redeploy** to take effect.

### `cosmix-v2` (`eas.json` build profiles + `.env`)
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsua29z...   # eas.json preview + production AND local .env → clerk.kosmiks.com
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_PRODUCTION_DOMAIN=https://www.kosmiks.com
EXPO_PUBLIC_ADMIN_DASHBOARD_URL=https://www.kosmiks.com
```

**Values must be in `eas.json`, not just `.env`.** `.env` is gitignored and **not read by EAS builds**. `eas.json` is itself gitignored. Env vars are **baked in at build time** — changes require a rebuild.

⚠️ EAS's **server-side** "preview" environment (expo.dev → servey → Environment variables) also defines `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, still with the old `pk_test`. The `eas.json` profile value wins, so builds are correct, but update or delete it to avoid confusion.

---

## 13. TODO — Outstanding Work

### 🔴 Security
- [x] **Bearer-key `isAdmin` fallback — FIXED 26 Oct 2026.** A request with only `EXPO_PUBLIC_ADMIN_API_KEY` (extractable from the APK) now resolves to the service user with **`isAdmin: false`** (`lib/admin-access.ts`). Admins are recognised only via a verified Clerk token + `users.isAdmin`; the app's admin screens already send `X-User-Token`. Same change: `GET /api/bookings` is scoped (admin → all; user → own by `userId` or `customerEmail`; key-only → 401) — it used to return every booking with customer names/emails; the unused `POST /api/bookings` (created confirmed, unpaid bookings) was removed; `/api/bookings/[id]` GET/PATCH/DELETE are admin-only; legacy `POST /api/upload` requires `getEndUser()`. Verified with key-only requests: admin routes 403, bookings 401/403, public routes 200.
- [ ] Consider whether a client-side shared key is the right model at all before launch (it now only grants anonymous/public access)
- [x] **Reviews — FIXED 26 Oct 2026.** The app sent no credentials, so every review submit and salon review list got 401 (0 reviews in the DB). `POST /api/reviews` had no identity check at all (anyone with the bearer key could write/overwrite any booking's review); it now requires `getEndUser()` and booking ownership (userId or customerEmail). `GET` returns the reviewer's first name only (it used to return their email and clerkId). App: `apiHeaders()` in `src/lib/api.ts`.
- [ ] **Delete the unused original `sk_live` key** in Clerk → production → API keys (keep the one created 23 Oct that Vercel uses)
- [ ] Delete `~/Desktop/kosmiks-secrets/client_secret_234539763868-….json` (no `_2_`) — it holds the revoked Google secret

### 🟠 Kosmiks / Clerk production follow-ups
- [ ] **Test a real payment on the Kosmiks build** — first release build with R8 minification; also confirms C1/P7 pushes
- [ ] **Sign in with the admin account** on the Kosmiks build and confirm its row re-links with `isAdmin` intact
- [ ] Update/delete the stale `pk_test` `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in EAS's server-side preview environment
- [ ] Apple sign-in for iOS (needs Apple Developer account — see §10)
- [ ] Remove the old `com.servey.app` Android app from Firebase once no tester uses the old APK
- [ ] Optional: Google brand verification + logo so the consent screen shows "Kosmiks" instead of "kosmiks.com"
- [ ] Change consent-screen support email and the `/privacy` contact to `support@kosmiks.com` once that mailbox exists (privacy policy currently lists it already — mail bounces until it exists)
- [ ] Have the client review `/privacy` (draft; no legal entity name)

### 🟠 Correctness
- [x] **One token per user — FIXED 26 Oct 2026.** `push_tokens` table (one row per device, `token` unique; registering the same token from another account moves it). `POST /api/user/push-token` upserts it and also keeps the legacy `users.pushToken` column on the latest device. All senders go through `notifyUser(userId)` / `notifyAdmins()`, which send to every device + the legacy column.
- [x] **Push receipt checking — FIXED 26 Oct 2026.** Successful tickets are stored in `push_tickets`; `DeviceNotRegistered` on send removes the token at once; the daily cron `/api/cron/push-receipts` (04:00 UTC, `vercel.json`) fetches receipts for tickets older than 15 min (Expo keeps them 24 h) and removes dead tokens (`removePushToken()`).
- [x] **Data repair — FIXED 26 Oct 2026.** `piis40060@gmail.com` sat on the `service-admin` row, so that account 401'd. `ensureServiceUser()` (`lib/service-auth.ts`) now resets the service row's email to `ADMIN_EMAIL` (or the fallback synthetic address) whenever it holds anything else; verified in production (service row now `…@cosmix.local`, no row holds the address).

- [x] **`CRON_SECRET` set in Vercel (Production, Sensitive) — 26 Oct 2026.** Both crons now run: `/api/cron/push-receipts` daily 04:00 UTC and **`/api/cron/payouts` every Friday 06:00 UTC — it had never run before**, so watch the first run (Vercel → Logs, `[CRON_PAYOUTS]`) and check the payouts it creates.
- [x] **Push token unregistered on sign-out — 26 Oct 2026.** `unregisterPushToken(getToken)` (`src/lib/push.ts`) runs before every `signOut()` (side menu, profile, rejected screen) and calls `DELETE /api/user/push-token`, which only removes the token from the caller's own account. Best-effort, 5 s cap — never blocks sign-out.

### 🟡 Housekeeping
- [ ] **Finish Cloudinary removal:** `CLOUDINARY_*` env vars **removed from Vercel (26 Oct 2026)**. Before deleting, verified: all 6 current provider documents exist in private R2, and nothing in the DB references Cloudinary. **Still to do (by hand — permanent deletion):** delete folder `cosmix/provider-documents` (and optionally `cosmix/salon-images`) on Cloudinary account `dhedbjqza` with CDN invalidation — the migrated documents are still publicly reachable there — then close accounts `dhedbjqza`, `dzmrvngco`, `dguk4ks45`
- [ ] Mark `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` as **Sensitive** in Vercel
- [ ] Update `scripts/cleanup-test-data.ts` keep-list; commit it
- [ ] Set up a Neon dev branch so local work stops hitting production
- [ ] Uninstall `@clerk/nextjs` — zero importers remain
- [ ] Likely-orphaned, not yet deleted: `components/settings/stripe-connect.tsx`, `hooks/billing/`, `components/main-nav.tsx`, `components/mobile-bottom-nav.tsx`, `components/loader.tsx`
- [ ] Replace the mock salon fallback in `map.tsx` (fake Helsinki pins) with an empty state

### 🔵 Blocked on client
- [ ] **Apple Developer account — $99/year.** Blocks iOS testing, App Store submission, APNs push, Apple Pay merchant cert, and Sign in with Apple.
- [ ] **GoDaddy mailboxes** — `support@kosmiks.com` + `admin@kosmiks.com`. Domain is on the client's account.
- [ ] Resend sending domain — `notify.kosmiks.com` recommended (SPF, DKIM, DMARC; DNS goes in Cloudflare)
- [ ] Hosting plan — Vercel Hobby prohibits commercial use. Pro is $20/mo.
- [ ] Stripe live mode (keys are still `sk_test` / `pk_test`)

---

## 14. Gotchas — read before debugging anything

1. **Expo Go cannot receive push notifications** (SDK 53+). All push testing must use an EAS build. Mixing Expo Go and APK testing (or old Servey + new Kosmiks APKs) produces different tokens for the same account, each overwriting the last.
2. **A green build does not mean working code.** Several failures compiled cleanly and only broke at runtime. Run the server and hit the routes.
3. **Grep with both quote styles.** An audit once missed importers by searching `"@clerk/nextjs"` with double quotes only.
4. **Push receipts, not send responses.**
5. **Never hardcode the Expo projectId.**
6. **Don't run `prisma migrate dev`.** Use `db push`, and check the diff first.
7. **The app uses Mapbox in a WebView**, not `react-native-maps`.
8. **`NEXT_PUBLIC_STRIPE_PUBLISH_KEY` is misspelled** in Vercel. Code matches the typo.
9. **`ADMIN_EMAIL` must never be a real user's address** — `ensureServiceUser()` would claim their row.
10. **Notification and email failures must never break the booking flow.**
11. **Qualification documents are `r2-private:` references, not URLs.** Only `resolveDocumentUrl()` server-side turns them into links.
12. **Filenames lie.** `admin-webview.tsx` has no WebView. Verify before assuming.
13. **Clerk production silently bounces a failed OAuth.** If Google sign-in returns to "Jatka Googlella" with no error, `sign-in.tsx` treated a missing session as "user cancelled". Check `clerk api /users/count --instance prod`: 0 means Clerk never completed the sign-up — usually bad Google credentials or a missing redirect allowlist entry.
14. **`clerk config pull` shows secrets as `REDACTED`.** Never compare against it. To check a Google client secret, POST a fake `code` to `https://oauth2.googleapis.com/token`: `invalid_client` = secret wrong/disabled, `invalid_grant` = secret valid.
15. **Google names repeat secret downloads `client_secret_2_…json`.** Globs like `client_secret_<number>-*` miss them.
16. **`clerk config patch` prints the full before/after diff — including secrets — on stderr.** Silence both streams (`>/dev/null 2>&1`) when patching credentials.
17. **Clerk production requires redirect URLs to be allowlisted** (`clerk api /redirect_urls --instance prod`). Dev accepts anything, so this only shows up after switching.
18. **`npx clerk@latest` can hang indefinitely.** Wrap calls in `timeout 60`.
19. **Stripe RN ≥ 0.81 breaks Android release builds** without `plugins/with-stripe-android-fixes.js` (lint → `play-services-tapandpay` not found; R8 → missing `pushProvisioning` classes).
20. **`/privacy` must stay public** — the Google OAuth consent screen links to it.
21. **Local development uses Clerk production too.** There is only one backend and database (both production), so `.env` has `pk_live`. A `401` on `getBookings` with a `user_3J…`-style ID in the logs means a session still on the old dev instance (old `.env` or old dev client). Use the Kosmiks dev client (`com.kosmiks.app`, scheme `kosmiks`); **Expo Go can't sign in** — production only allowlists `kosmiks://oauth-native-callback`, not `exp://`.
22. **Many source files use CRLF or mixed line endings.** Python `open()` in text mode silently converts them to LF and turns a 3-line change into a whole-file diff. Edit with `open(p, newline='')`, or check `git diff --stat` after scripted edits.
23. **New native modules need new builds.** `@react-native-community/netinfo` and `expo-image` (Oct 2026) mean dev clients and APKs built before them crash with "native module not found".
24. **NetInfo must use the JS reachability probe** (`NetInfo.configure({ useNativeReachability: false })` at the top of `src/lib/network.ts`). With Android's native "validated" flag the offline banner stayed stuck after airplane mode was turned off (Samsung, Oct 2026). Keep the configure call above any NetInfo use.
25. **The app's bearer key is public.** Anything reachable with `Authorization: Bearer <EXPO_PUBLIC_ADMIN_API_KEY>` alone is reachable by anyone. Never grant admin or per-user data on it: use `requireAdmin()` / `isAdmin` for admin, `getEndUser()` for anything owned by a person, and return 401 for the service user (`clerkId === ADMIN_EXTERNAL_ID`) on user data.
