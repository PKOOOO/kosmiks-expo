# Kosmiks — Full Project Context

> Handoff document. Paste at the start of a new chat to restore context.
> Last updated: 8 November 2026 (moved from Vercel + Neon to Railway; new Stripe account) — supersedes all earlier versions.
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
| `cosmix-admin` | Next.js **API-only** backend on **Railway** since 8 Nov 2026 (plus `/`, `/privacy`, `/public/[category]`) — see §9 Railway |
| Database | **Railway PostgreSQL 18** via Prisma (Neon until 8 Nov 2026) |
| Auth | Clerk **production instance** on `kosmiks.com` (mobile SDK + `@clerk/backend` `verifyToken` server-side) — see §5a |
| Payments | Stripe — customers pay the platform; providers are paid with **Stripe Connect** (separate charges and transfers, see §4). Platform account `acct_1UZR…` (Finland, EUR, **test mode**, marketplace + platform loss liability) since 8 Nov 2026. |
| Images & files | **Cloudflare R2** — see §9 Storage |
| Maps | **Mapbox GL JS inside a WebView** — `react-native-maps` is NOT installed |
| Email | **Resend** HTTP API from `notify.kosmiks.com` (EU region, domain id `c2b73f8c-7d82-405c-beef-9f45cf128dff`) when `RESEND_API_KEY` is set (`lib/email.ts`); otherwise Gmail SMTP via nodemailer, which **Railway Hobby blocks** (outbound SMTP is Pro-only). The Railway key is send-only; the Resend CLI (`~/.resend/bin/resend`) is logged in with full access |
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

**Phase 2 — Verification (4 steps):** Legal full name → Date of birth (18+) → Qualification documents (up to 3) → Terms & Submit. IBAN and account holder were removed on 8 Nov 2026 — providers give their bank details to Stripe (§4). The backend still accepts them from old app builds.

**Phase 3 — Salon Setup (step-by-step):** Salon name → Short intro → Description → **Mapbox map location picker** → Opening hours (7 days) → Photos (required, up to 6)

On Phase 3 submit → status becomes **ACTIVE** immediately, no admin review.

---

## 4. Payout Model — Stripe Connect (since 8 Nov 2026)

- **10% platform fee.** Customers pay the **platform** (checkout unchanged). A provider's share (90%) is sent to **their own Stripe account**, which Stripe pays out to their bank.
- **No Stripe until there are earnings.** The provider's payouts tab shows "Set up payouts" only once they have earnings. Stripe-hosted onboarding collects ID, address and bank account — Kosmiks never stores bank details.
- **Provider pulls the money:** a **Withdraw** button sends the available balance (bookings paid online whose appointment has passed, not yet paid out). There is **no payout cron** and no admin payout run any more.
- **Code:** `lib/stripe-connect.ts` (backend). `ensureStripeAccount()` creates the account with **Accounts v2** (`POST /v2/core/accounts`, `Stripe-Version: 2026-10-28.preview`): `configuration.recipient` with `stripe_balance.stripe_transfers`, `dashboard: "express"`, `defaults.responsibilities` `fees_collector`/`losses_collector` = `application`. This platform **must** use v2 — v1 `type: express` is rejected. Account links, login links, `accounts.retrieve` and transfers use v1 calls on the v2 account id (verified in test mode).
- **Withdraw** (`withdrawBalance()`): claims the eligible bookings into one `processing` Payout (double taps can't pay twice), then **one transfer per booking** with that booking's charge as `source_transaction` (works while the charge's funds are still pending), idempotency key `booking-transfer-<bookingId>`, stored in `bookings.transferId`. A failed transfer releases its booking back to the balance. Payout ends `transferred` (or `failed`).
- **Routes:** `POST /api/provider/stripe/onboard` → `{url}`; `GET /api/provider/stripe` → status (synced to `users.stripeDetailsSubmitted` / `stripePayoutsEnabled` = transfers capability active); `POST /api/provider/stripe/dashboard` → login link; `POST /api/provider/payouts/withdraw`. Onboarding returns to `/callback/stripe/success|refresh`, which open `kosmiks://stripe-return` (the app opens Stripe with `WebBrowser.openAuthSessionAsync`, `src/lib/stripe-payouts.ts`; `src/app/stripe-return.tsx` is the fallback route).
- **Stripe platform settings this needs** (Connect → Platform setup): business model **"You collect payments and pay recipients"** (marketplace) and **platform negative-balance liability acknowledged**. The first Stripe account (`acct_1UWI…`) was set up as "merchants collect directly" and could not be changed, so it was replaced.
- **Old manual SEPA payouts** (`scheduled → sent → arrived`, IBAN on the payout) still display; the admin can still move them along. `payouts.iban` is optional now.
- **Costs:** Stripe Connect fees (per active account and per payout) come out of the platform's 10%.

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
| Native redirect allowlist (prod) | `kosmiks://oauth-native-callback` — **required**. Production rejects any redirect URL not on the list; dev accepts anything. **Temporary (29 Oct 2026):** `exp://192.168.1.196:8081/--/oauth-native-callback` (id `ru_3LMyzXfH2bKDdDHO9bpy1pEH22O`) so Google sign-in works in Expo Go on the iPhone until an iOS dev client exists. It is tied to the dev machine's LAN IP — if the IP changes, add the new one. **Remove before launch.** |
| Sign-up requirements | Identical to dev (no phone/username/legal-consent requirements). |

Clerk users are **not** copied between instances — every user got a new Clerk ID in production. **`getOrCreateUserFromClerk()` re-links by verified email:** if no row has the incoming `clerkId` but a row has the same email *and* Clerk reports that email as `verified`, the row's `clerkId` is moved to the new ID. It never re-keys the synthetic `service-admin` row. This also fixes guest-checkout rows (`clerkId: temp_…` with a real email) that previously 401'd when the guest later signed in.

Verified on 23 Oct 2026: a provider account signed in on the Kosmiks build and kept its row (created 2026-09-23), `ACTIVE` status, salon, booking, and got a new push token.

**Secret keys:** a production instance can have several secret keys; any of them works. The backend uses one created on 23 Oct 2026 (stored in Railway, copied from Vercel). The original auto-created key was never used — delete it (§13).

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

**Refunds on cancel (29 Oct 2026):** `refundBooking()` (`lib/refunds.ts`) refunds a cancelled booking's online payment through Stripe **before** the status changes: only this booking's `totalAmount` (one PaymentIntent can pay for several bookings), idempotency key `booking-cancel-<id>` so retries never refund twice, refund id stored in `bookings.refundId`, reason in `bookings.cancelReason`. If Stripe fails, the booking is not cancelled (502). Used by the salon cancel (`PUT /api/provider/bookings/[id]`) and the admin cancel (`PATCH /api/bookings/[id]`). Verified in Stripe test mode (partial refund of 85 € out of a 130 € PaymentIntent, retry returned the same refund).

**Provider booking actions** (`PUT /api/provider/bookings/[id]`, `{ status, reason? }`): `cancelled` (from confirmed/pending, before payout), `completed` / `no_show` (confirmed and start time passed), `confirmed` (undo completed/no_show before payout; no-op on an already confirmed booking for old APKs). Anything already in a payout → 409. `completed` and `no_show` still count as provider earnings (`EARNING_STATUSES`). The list endpoint never returns the internal service account as the customer (guest bookings) and adds `customerEmail`, `notes`, `paid`, `refunded`, `paidOut`, `cancelReason`, `durationMinutes`.

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
| C2 | Provider cancels a booking (includes the reason and "payment will be refunded") | Customer | `provider/bookings/[bookingId]` PUT (added 26 Oct 2026) |
| C3 | Admin changes a booking's status | Customer | `bookings/[bookingId]` PATCH (added 26 Oct 2026) |
| P9 | Payout sent (old manual SEPA payouts only) | Provider | `admin/payouts/[id]` |

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
- Standard config (`config.basemap`): `lightPreset` from the device clock (night <5 / ≥21, dawn <8, day <17, dusk), re-applied every 10 min with `setConfigProperty`; `theme: 'faded'`; `showPointOfInterestLabels: false` (only Kosmiks salons stand out); `show3dObjects` + pitch 55 / bearing −17 on every iPhone (iOS caps `hardwareConcurrency`, so it can't be used there) and on Android only when `navigator.hardwareConcurrency > 4` (flat on weak phones); `colorBuildingSelect: '#D7C3A7'` (the pin ring's beige; dark brown made whole blocks look like a solid dark mass).
- **Branded pins:** HTML markers (name pill, brown round head with the arch-K, tip); selected = larger + pulsing beige ring.
- **Selected building:** `queryRenderedFeatures([[x-45,y-45],[x+45,y+45]], { target: { featuresetId: 'buildings', importId: 'basemap' } })` around the pin, nearest footprint centre wins, then `setFeatureState(feature, { select: true })`. A salon's coordinate usually sits on the pavement, so an exact-point query misses. The ring is the fallback.
- **Messages:** WebView → app `mapReady` (app re-sends the current selection), `markerTap`; app → WebView `selectSalon`, `centerOnLocation`, `zoomToService`. iOS delivers on `window`, Android on `document` — the page listens on both.
- **Layout (29 Oct 2026):** search bar floats at the top of the map; cards sit at the bottom just above the Mapbox logo; camera padding `MAP_PAD = { top: 70, bottom: 300 }` keeps the selected salon between them.
- **Bottom cards** (swipe = select + fly + highlight): photo + count, name, rating ("Uusi" with no reviews), **open/closed** from the salon's opening hours (`getOpeningStatus()` in `src/lib/opening-hours.ts`, Finnish format "Avoinna nyt · sulkeutuu 18.00"), address, **Reittiohjeet** (native maps) and **Varaa** (→ `/services`). Card body opens the detail modal.
- **Backend:** `GET /api/public/saloons/map` returns `timeSlots` (opening hours) and reviewers' first names only.
- **Route in the app (29 Oct 2026):** "Reitti" (detail sheet) and "Reittiohjeet" (card) no longer open Apple/Google Maps. They ask for location, then the page fetches the Mapbox **Directions API** (`walking`/`driving`, same token) and draws a brown line with a white casing (`slot: 'top'` on v3 — `'middle'` hides it behind 3D buildings). The search bar is replaced by a route panel (Kävely/Auto, "12 min · 900 m", ✕). Messages: app → page `showRoute {from, to, profile}`, `clearRoute`; page → app `routeReady {duration, distance}`, `routeError`. Swiping to another salon clears the route. No transit routes and no turn-by-turn (would need a native navigation SDK).
- **"Soita"** opens the dialler (`tel:`) with `saloons.phone`; hidden when the salon has no phone. The detail sheet shows "★ Uusi" until the first review.
- The Mapbox **Places API** (business details, busy times) was evaluated and **not used**: public preview, busyness only for North America/Western Europe, and providers already enter their own hours/photos.

**All three map pages share `src/lib/map-html.ts`** (29 Oct 2026): `MAPBOX_LOADER_JS` (WebGL2 check → v3.32.0 + Standard or v2.15.0 + `streets-v12`; defines `gl2`, `use3d`, `MAPBOX_STYLE`, `lightPreset()`, `loadMapbox(cb)`), `KOSMIKS_PIN_CSS` / `KOSMIKS_PIN_JS` (`makeKosmiksPin(name, small)`). Bump the GL JS version there, once.
- **Salon list mini map** (`saloons.tsx`): non-interactive, Standard + light preset + faded theme, POI labels off, pitch 45 on capable phones, small Kosmiks pins, `fitBounds` around all salons (pass `pitch` — `fitBounds` resets it).
- **Address picker** (`AddressMapPicker.tsx`, Phase 3 + provider salon screen): **3D like the main map since 29 Oct 2026** (clock light preset, pitch 45 / bearing −17 on capable phones, zoom 16 when the salon has coordinates). The building under the pin is highlighted beige after every drag/search (`highlightBuilding(map, lngLat)` from `BUILDING_HIGHLIGHT_JS` in `map-html.ts`, shared with the main map). The pin is an HTML marker, so buildings never cover it; dragging the map keeps the pin at the screen centre. Keeps its own green location pin. `window.setMarker/setMarkerLabel/setMarkerIcon` exist before the map loads (RN calls them on mount); an early `setMarker` is applied once ready.
- **Flat-map fallback (8 Nov 2026):** `watchMap(map, restart)` in `MAPBOX_LOADER_JS`. An Android phone showed a blank map with only the pins (WebGL2 reported, Standard style never drew). If the 3D map errors before loading, loses its WebGL context, doesn't get its style within 30 s, or doesn't finish drawing 15 s after the style arrived, the page removes it, switches to v2 + `streets-v12` and re-runs its start function (main map → `mapFallback` message, logged as `[MAP] 3D map failed`). Verified in headless Chrome with a broken style URL.
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

### Railway (backend + database, since 8 Nov 2026)
- Account `gabrielpius0311@gmail.com`, workspace "Gabriel's Projects", **Hobby plan**. Project **`kosmiks-database`** (`bb3ee979-bb54-475e-8ebe-baf5675684eb`), environment `production` (`ecbf7aaf-a2f7-4d18-a82d-63f0849d8b79`).
- Services:

| Service | ID | What |
|---|---|---|
| `cosmix-admin` | `2bbde094-0b79-4600-a025-733aab2ac209` | The API. Built by Railpack from GitHub `PKOOOO/cosmix-admin` `main` — **every push to main deploys**. Healthcheck `/api/public/health`, restart on failure. Domains: `www.kosmiks.com`, `kosmiks.com`, `cosmix-admin-production.up.railway.app` |
| `Postgres` | `51a0abc7-f33b-4df8-a923-0608cda0c7d3` | PostgreSQL 18. **No public port** — the API reaches it over the private network (`DATABASE_URL=${{Postgres.DATABASE_URL}}`) |
| `cron-push-receipts` | `0546d7ee-17fb-48bf-b2dc-fc1f211e00b1` | `alpine` + `wget` → `GET /api/cron/push-receipts`, schedule `0 4 * * *` (UTC) |

  (`cron-payouts` existed from 8 Nov until Stripe Connect replaced it the same day; deleted.) The cron reads `CRON_SECRET=${{cosmix-admin.CRON_SECRET}}` and `API_HOST=${{cosmix-admin.RAILWAY_PUBLIC_DOMAIN}}`; logs are in each cron service.
- **Database access from this machine:** `railway ssh -p <project> -e production -s Postgres -- psql -U "$PGUSER" -d "$PGDATABASE"` (SSH key `kosmiks-laptop`, `~/.ssh/id_ed25519`, registered with Railway on 8 Nov 2026). For a one-off script, pipe SQL into `psql -f -`. Prisma CLI commands (`db push`, `migrate diff`) can't reach the private DB from here — run them through `railway ssh` into `cosmix-admin`, or temporarily add a TCP proxy (needs approval).
- **Railway refuses to build dependencies with known high CVEs** (it blocked Next 14.2.30 → upgraded to 14.2.35). Keep `next` patched.
- **Migration (8 Nov 2026):** `pg_dump` (v18, run inside the Railway Postgres container, Neon is PG 17) → `pg_restore`; all 14 tables matched row-for-row. Then the test bookings/payouts/reviews were deleted on Railway. **Neon (`ep-long-cloud-adg7mkpl`) still holds the pre-migration data as a backup** and Vercel project `cosmix-admin` (`prj_4MhmPJlCLL2IhgcYmF97fV6b2DO9`) still exists — see §13.

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
- **`kosmiks.com`** purchased by the client on GoDaddy (still the registrar — GoDaddy only holds the nameserver setting), served by **Railway** with Railway-issued SSL since 8 Nov 2026
- **DNS is on Cloudflare** (nameservers `devin` / `tori.ns.cloudflare.com`). Edit DNS in Cloudflare, not GoDaddy. Zone ID `1c429a45bd6c239aba403792492dc057`. A DNS-edit API token for this zone is at `~/.cloudflare-kosmiks-token`.
- API records (must stay **DNS only (gray cloud)**): `CNAME www → 6elwurdk.up.railway.app`, `CNAME kosmiks.com → nufq9dse.up.railway.app` (Cloudflare flattens the apex), plus TXT `_railway-verify.www` / `_railway-verify` for Railway's domain verification. Before 8 Nov 2026 they pointed at Vercel (`A 216.198.79.1`, `CNAME …vercel-dns-017.com`).
- **Clerk records (all DNS only — proxying breaks Clerk verification):**

| Host | Target |
|---|---|
| `clerk.kosmiks.com` | `frontend-api.clerk.services` |
| `accounts.kosmiks.com` | `accounts.clerk.services` |
| `clkmail.kosmiks.com` | `mail.zl2bvjw49d3q.clerk.services` |
| `clk._domainkey.kosmiks.com` | `dkim1.zl2bvjw49d3q.clerk.services` |
| `clk2._domainkey.kosmiks.com` | `dkim2.zl2bvjw49d3q.clerk.services` |

- `media.kosmiks.com` → R2 (proxied). `_dmarc` TXT exists.
- Resend (`notify.kosmiks.com`, see §1): DKIM TXT `resend._domainkey.notify`, MX + SPF TXT `send.notify`, CNAME `rsend.notify` — DNS only.
- **Use `https://www.kosmiks.com`** for API calls. On Railway the apex serves the same app directly (no more 308 redirect to `www`), but every build uses `www`.
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

**Logo (Oct 2026):** a petal K cut out of an arch, dark brown `#423120`, wordmark KOSMIKS in Philosopher Bold with wide letter spacing. Client sheet: https://claude.ai/artifact/CshjguquQYaLK4KsTa7gbT. In the app: `assets/icon.png` (opaque), `assets/adaptive-icon.png`, `assets/splash.png`, `assets/notification-icon.png` (rendered by `.logo-design/render-icons.js`, git-excluded) and `<KosmiksLogo size wordmark color />` (`src/components/KosmiksLogo.tsx`, react-native-svg, K is a mask cut-out so it works on any background) used by `Header` (when the title is the brand) and `BrandHeader` (every provider/admin dashboard tab, incl. provider Services since 29 Oct 2026). **Tapping the logo** goes to the customer home: `Header` → `router.push('/')`, `BrandHeader` → `router.replace('/')` (the root layout is a `Slot`, not a stack, so there is no history to keep). Providers/admins get back to their dashboard through the side menu (→ `admin-webview` role router). Still to export: Play Store icon 512×512 (before submission) and the 120×120 Google consent-screen logo (triggers Google brand verification).

**Apple sign-in** is hidden in `src/app/(app)/sign-in.tsx` behind `APPLE_SIGN_IN_ENABLED = false` (it is disabled on the Clerk production instance). App Store rule 4.8 requires it on iOS when Google sign-in is offered — enable it, **iOS only**, before the iOS launch. No Mac needed: Apple keys are created on developer.apple.com, iOS builds/submission run on EAS, testing needs an iPhone registered via `eas device:create`.

---

## 11. Database

- **No real Prisma migration history.** Use `npx prisma db push`. **Never `prisma migrate dev`** — it detects drift and offers to reset, which would wipe production. A fake baseline sits at `prisma/migrations/20240101000000_init`.
- There is no dev database. Schema changes go to production (Railway) — see §9 Railway for how to reach it.
- Before any `db push`, run `prisma migrate diff --from-schema-datasource --to-schema-datamodel --script` and confirm the output.
- **`saloons.phone`** (added 29 Oct 2026 with `db push`) is the public number behind the map's "Soita" button. Existing salons were filled from their Phase 1 `ProviderApplication.phone`; new salons get it when created (`approve` route, `GET /api/provider/saloon`). Providers edit or clear it on the salon screen ("Phone shown to customers"); `PATCH /api/saloons/[id]` validates it (7–15 digits, empty = remove). The Phase 1 phone itself is never returned publicly.
- **Production database is Railway Postgres** (§9). The local `cosmix-admin/.env` `DATABASE_URL` still points at **Neon (the old copy)** — local scripts and Prisma Studio now hit the backup, not production. Use `railway ssh` for production queries.
- A cleanup script exists at `scripts/cleanup-test-data.ts` — **untracked**, dry-run by default, `--execute` to run. **Update `KEEP_EMAILS` before running.**

---

## 12. Environment Variables

### `cosmix-admin` (Railway service `cosmix-admin`; copied from Vercel on 8 Nov 2026)
```
CLERK_SECRET_KEY=sk_live_...        # Clerk PRODUCTION instance (kosmiks.com) since 23 Oct 2026
DATABASE_URL=${{Postgres.DATABASE_URL}}   # Railway reference variable → private network
STRIPE_SECRET_KEY=sk_test_...       # Stripe platform acct_1UZR… (8 Nov 2026), keys in ~/Desktop/new_stripe
STRIPE_WEBHOOK_SECRET=whsec_...     # endpoint we_1UZSW7… (payment_intent.succeeded/processing/canceled, refund.created)
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...  # Connect endpoint we_1UZSW9… (account.updated); both → https://www.kosmiks.com/api/webhooks/stripe
NEXT_PUBLIC_STRIPE_PUBLISH_KEY=pk_test_...   # NOTE: "PUBLISH" not "PUBLISHABLE" — typo, code matches. Returned by POST /api/checkout; the app uses it
ADMIN_EMAIL=admin@cosmix.local      # must stay synthetic, never a real user's address
R2_ACCOUNT_ID=a929da41595f86d4bca91509a6c28997
R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY   # token "servey-api"
R2_PUBLIC_BUCKET=kosmiks
R2_PRIVATE_BUCKET=kosmiks-documents
R2_PUBLIC_URL=https://media.kosmiks.com
CRON_SECRET=...                     # generated 8 Nov 2026 (Vercel's was sensitive/unreadable); the cron services reference it
ADMIN_API_KEY, ADMIN_EXTERNAL_ID, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_MAPBOX_KEY, SMTP_*   # copied from Vercel
# SMTP_* (Gmail) can't connect from Railway Hobby — only used if RESEND_API_KEY is unset.
RESEND_API_KEY=re_...                # send-only key (from ~/Desktop/new_stripe), set 8 Nov 2026
EMAIL_FROM=Kosmiks <noreply@notify.kosmiks.com>   # must be on the Resend-verified domain
```
Setting a variable on Railway redeploys the service (unless skipped). Set secrets with `railway variable set KEY --stdin` so values never appear in a command line.

### `cosmix-v2` (`eas.json` build profiles + `.env`)
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsua29z...   # eas.json preview + production AND local .env → clerk.kosmiks.com
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...   # new account since 8 Nov 2026 (eas.json + .env). Only the default: checkout calls initStripe() with the key the server returns, so a Stripe switch doesn't need a rebuild from builds after 6c37c1c
EXPO_PUBLIC_PRODUCTION_DOMAIN=https://www.kosmiks.com
EXPO_PUBLIC_MAPBOX_TOKEN=pk.…   # in eas.json preview + production since 8 Nov 2026 (before, only EAS's server-side env had it)
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
- [ ] **Delete the unused original `sk_live` key** in Clerk → production → API keys (keep the one created 23 Oct that the backend uses — now in Railway)
- [ ] Delete `~/Desktop/kosmiks-secrets/client_secret_234539763868-….json` (no `_2_`) — it holds the revoked Google secret

### 🟠 Kosmiks / Clerk production follow-ups
- [ ] **Test a real payment on the Kosmiks build** — first release build with R8 minification; also confirms C1/P7 pushes
- [ ] **Sign in with the admin account** on the Kosmiks build and confirm its row re-links with `isAdmin` intact
- [ ] Update/delete the stale `pk_test` `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in EAS's server-side preview environment
- [ ] Apple sign-in for iOS (needs Apple Developer account — see §10)
- [ ] **Remove the temporary Expo Go redirect URL** `exp://192.168.1.196:8081/--/oauth-native-callback` from Clerk production before launch: `clerk api /redirect_urls/ru_3LMyzXfH2bKDdDHO9bpy1pEH22O --instance prod -X DELETE`
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

### 🔴 Booking & payment logic (found 29 Oct 2026 — not started)
- [ ] **Customer cancel is fake.** "Peruuta varaus" in `src/app/(app)/bookings.tsx` (`confirmCancel`) only removes the booking from the local list — nothing reaches the server, the salon still expects the customer, no refund. Needs a real endpoint + a **cancellation rule (client to decide, e.g. free until 24 h before, then no refund)**; reuse `refundBooking()` (`lib/refunds.ts`) and notify the provider.
- [x] **Stripe webhook — DONE 8 Nov 2026.** `POST /api/webhooks/stripe` (signature-verified, two endpoints): `payment_intent.succeeded`/`processing` confirm bookings through `confirmPendingBookings()` (`lib/booking-confirmation.ts`, shared with `PATCH /api/checkout`, notifications only from the call that flips the booking); `payment_intent.canceled` cancels its pending bookings; `refund.created` without `metadata.bookingId` (= made in the Stripe dashboard) cancels fully refunded bookings; `account.updated` syncs provider flags. **Verified end to end in test mode:** a booking paid with no app call became `confirmed`, and a dashboard-style refund cancelled it.
- [ ] **Abandoned `pending` bookings block slots forever.** `available-slots` excludes everything except `cancelled`, so an opened-then-abandoned checkout keeps the slot taken. Expire unpaid `pending` bookings after ~30 min (cron, e.g. alongside `push-receipts`; check the PaymentIntent status first so a late payment isn't lost). The webhook only frees slots for PaymentIntents that are explicitly cancelled — Stripe never cancels an abandoned one by itself, so this is still needed.
- [ ] **Double booking possible.** The time picker hides taken slots, but `POST /api/checkout` doesn't re-check, so two customers paying for the same time at the same moment both get it. Re-check overlap (same logic as `available-slots`) inside checkout before creating the bookings.
- [x] **First Friday payouts cron run — 30 Oct 2026, correct.** It created two `scheduled` payouts with the 10% fee applied (85 € → 76.50 €, 25 € → 22.50 €); they were test data and were deleted on 8 Nov 2026. Superseded by Stripe Connect withdrawals (no payout cron).
- [ ] **C4 appointment reminder** — push to the customer the day before / a few hours before (cron).
- [ ] Recommended order: expiry + double-booking re-check together, then customer cancel once the rule is decided.

### 🟠 Railway / Stripe migration follow-ups (8 Nov 2026)
- [ ] **Pause, then delete the Vercel project** `cosmix-admin` (pausing via the API was blocked by the permission check — do it in the Vercel dashboard). It still auto-deploys every push to `main` (pointing at Neon), but no domain routes to it. Delete after ~1 week without problems.
- [ ] **Delete the Neon project** after ~1 week (it holds the pre-migration backup, including the deleted test bookings). Remove the old Neon `DATABASE_URL` from `cosmix-admin/.env` then.
- [ ] **Build a new APK** for testers: installed builds have the old Stripe publishable key built in and can't pay against the new account. Builds from `6c37c1c` on take the key from the server.
- [ ] Test a full payment + provider cancel/refund on the new Stripe account (test card `4242 4242 4242 4242`).
- [ ] **Test Stripe Connect end to end in the app:** a provider with earnings → Set up payouts → Stripe test onboarding (Stripe's test data: phone `000 000 0000`, SMS code `000000`, test IBAN `FI2112345600000785`) → Withdraw → transfer visible in Stripe. Not yet done — onboarding needs the hosted page. Also confirm the Express login link works for v2 accounts.
- [ ] **Decide: delete the IBANs already stored** in `provider_applications` (no longer needed; asked 8 Nov 2026, not done — permanent).
- [ ] The first Stripe account `acct_1UWI…` (keys replaced) is unused — can be closed.
- [ ] **Confirm a booking email arrives through Resend.** Railway Hobby blocks SMTP (found 8 Nov 2026 — pushes arrived exactly 2 min late because they waited for the SMTP timeout; fixed in `8d10cbb`: pushes first, emails in the background). Resend set up the same day: domain `notify.kosmiks.com` **verified**, DNS records in Cloudflare, `RESEND_API_KEY` + `EMAIL_FROM` on Railway, deployed with `1e071ad` (email wording now "paid online"). Not yet tested with a real booking.
- [ ] Activate the new Stripe account (business details) before live mode — `charges_enabled` is false.
- [ ] Optional: remove the SSH key `kosmiks-laptop` from Railway (account → SSH keys) if this machine shouldn't keep database access.

### 🟡 Housekeeping
- [ ] **Finish Cloudinary removal:** `CLOUDINARY_*` env vars **removed from Vercel (26 Oct 2026)**. Before deleting, verified: all 6 current provider documents exist in private R2, and nothing in the DB references Cloudinary. **Still to do (by hand — permanent deletion):** delete folder `cosmix/provider-documents` (and optionally `cosmix/salon-images`) on Cloudinary account `dhedbjqza` with CDN invalidation — the migrated documents are still publicly reachable there — then close accounts `dhedbjqza`, `dzmrvngco`, `dguk4ks45`
- [ ] Update `scripts/cleanup-test-data.ts` keep-list; commit it
- [ ] Set up a dev database (e.g. a second Railway environment) so schema work stops hitting production
- [ ] Uninstall `@clerk/nextjs` — zero importers remain
- [ ] Likely-orphaned, not yet deleted: `components/settings/stripe-connect.tsx`, `hooks/billing/`, `components/main-nav.tsx`, `components/mobile-bottom-nav.tsx`, `components/loader.tsx`

### 🔵 Blocked on client
- [ ] **Apple Developer account — $99/year.** Blocks iOS testing, App Store submission, APNs push, Apple Pay merchant cert, and Sign in with Apple.
- [ ] **GoDaddy mailboxes** — `support@kosmiks.com` + `admin@kosmiks.com`. Domain is on the client's account.
- [ ] Resend sending domain — `notify.kosmiks.com` recommended (SPF, DKIM, DMARC; DNS goes in Cloudflare)
- [x] Hosting plan — moved to Railway Hobby ($5/mo, commercial use allowed) on 8 Nov 2026.
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
8. **`NEXT_PUBLIC_STRIPE_PUBLISH_KEY` is misspelled** (Railway variable). Code matches the typo.
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
21. **Local development uses Clerk production too.** There is only one backend and database (both production), so `.env` has `pk_live`. A `401` on `getBookings` with a `user_3J…`-style ID in the logs means a session still on the old dev instance (old `.env` or old dev client). Use the Kosmiks dev client (`com.kosmiks.app`, scheme `kosmiks`); **Expo Go can only sign in from an allowlisted `exp://<LAN IP>:8081/--/oauth-native-callback`** — one is allowlisted temporarily for the iPhone (§5a); a new LAN IP gives "redirect url … does not match" until it is added.
22. **Many source files use CRLF or mixed line endings.** Python `open()` in text mode silently converts them to LF and turns a 3-line change into a whole-file diff. Edit with `open(p, newline='')`, or check `git diff --stat` after scripted edits.
23. **New native modules need new builds.** `@react-native-community/netinfo` and `expo-image` (Oct 2026) mean dev clients and APKs built before them crash with "native module not found".
24. **NetInfo must use the JS reachability probe** (`NetInfo.configure({ useNativeReachability: false })` at the top of `src/lib/network.ts`). With Android's native "validated" flag the offline banner stayed stuck after airplane mode was turned off (Samsung, Oct 2026). Keep the configure call above any NetInfo use.
25. **The app's bearer key is public.** Anything reachable with `Authorization: Bearer <EXPO_PUBLIC_ADMIN_API_KEY>` alone is reachable by anyone. Never grant admin or per-user data on it: use `requireAdmin()` / `isAdmin` for admin, `getEndUser()` for anything owned by a person, and return 401 for the service user (`clerkId === ADMIN_EXTERNAL_ID`) on user data.
26. **Railway blocks builds with vulnerable dependencies** ("SECURITY VULNERABILITIES DETECTED" in the build log, deployment FAILED in seconds). Upgrade the package it names; it is not a code error.
27. **The Railway database has no public port.** Reach it with `railway ssh` (§9 Railway). Opening a TCP proxy exposes it to the internet — only temporarily and with approval.
