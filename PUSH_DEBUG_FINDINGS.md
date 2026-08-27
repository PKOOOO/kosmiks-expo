# Push Notifications — Android APK `pushToken: null` — Findings & Fix Plan

**Status:** Root cause identified. No code changed yet.
**Symptom:** On real Android APK builds (Samsung, Oppo) the signed-in users have `pushToken: null` in the DB. Expo Go on iPhone registers tokens fine. Emails work; push does not.

---

## Root cause (definitive): projectId mismatch

`getExpoPushTokenAsync({ projectId })` is called with a **hardcoded** projectId that does **not** match the EAS project this APK was built under.

| What | Location | Value |
|------|----------|-------|
| Build's EAS project | `app.json` → `extra.eas.projectId` (owner `kpkk`) | `e001f7f4-9117-4d83-b0d6-21bbe8b84511` |
| projectId passed to `getExpoPushTokenAsync` | `src/app/_layout.tsx` → `EXPO_PUSH_PROJECT_ID` | `1799dbe5-5b7f-4843-b08a-d8df021f6f40` |

On a **standalone build**, Expo validates the projectId against the build's real project and **throws** on mismatch. The throw is caught by the `try/catch` and logged via `console.error` (invisible on an installed APK). Result: token never obtained → POST to `/api/user/push-token` never fires → `pushToken` stays `null`.

**Why Expo Go on iPhone still works:** Expo Go issues push tokens under its own shared experience with lenient projectId handling, so the mismatch doesn't block it there. This is exactly why the failure is Android-APK-only.

### Where the flow breaks
`src/app/_layout.tsx` → `PushNotificationRegistrar`:
1. `getExpoPushTokenAsync({ projectId: EXPO_PUSH_PROJECT_ID })` **throws** (mismatch).
2. Control jumps to `catch (error) { console.error(...) }` — swallowed, invisible on APK.
3. The `fetch(API_ENDPOINTS.PUSH_TOKEN, ...)` below it **never runs**.

The other steps (retry-every-launch, `Device.isDevice`, permission check, channel creation, the POST/endpoint) are all correct and are **not** the cause.

---

## Fix plan

### 1. (Required) Make the projectId match the build — pick ONE approach

**Approach A — use the app.json projectId at runtime (recommended, self-healing).**
Read the projectId from the build config instead of hardcoding it, so it can never drift from the EAS project again:

- `import Constants from "expo-constants"` (already a dependency).
- Replace the hardcoded `EXPO_PUSH_PROJECT_ID` with:
  `Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId`
- This is the exact pattern Expo's own docs recommend.

**Approach B — hardcode the correct id.**
Set `EXPO_PUSH_PROJECT_ID = "e001f7f4-9117-4d83-b0d6-21bbe8b84511"` to match `app.json`.
(Brittle — the id already drifted once from `c345dcb1…` → `1799dbe5…` → now `e001f7f4…`. Prefer A.)

> Whichever is chosen, the app.json `eas.projectId` MUST be the project that owns the EAS build + push credentials.

### 2. (Required for delivery) Confirm FCM V1 credentials on EAS project `e001f7f4`
Token registration alone isn't enough — Android delivery needs FCM.
- `google-services.json` is already correct: `package_name = com.servey.app`, `project_id = servey-5eee1`.
- Verify the Firebase **FCM V1 service-account key** is uploaded to the current EAS project:
  `eas credentials` → Android → confirm "FCM V1" is set for `com.servey.app`.
- If missing, uploading it is required or pushes register but never arrive.

### 3. (Recommended) Surface errors instead of swallowing them
The `catch` currently hides the real failure on APKs. Add explicit `console.error`/`console.log`
at each step (entry, `Device.isDevice`, permission status, channel, before/after
`getExpoPushTokenAsync`, before/after the POST). Capture on-device with:
```
adb logcat | grep PUSH
```
Keep this instrumentation until push is verified working, then trim.

### 4. (Minor) Android 13+ permission prompt not appearing on install
Expected — Android 13+ only shows the prompt when `requestPermissionsAsync()` runs, which is
inside the registrar. Because the registrar currently throws at the token step, first-run UX is
fine but worth re-testing after the projectId fix. `POST_NOTIFICATIONS` is already in
`app.json` android permissions.

---

## Verification checklist (after applying #1 and #2)
1. `adb logcat | grep PUSH` during launch → see `getExpoPushTokenAsync SUCCESS. token = ExponentPushToken[...]`.
2. `POST /api/user/push-token` logs `HTTP 200`.
3. Prisma Studio → the Samsung/Oppo accounts now have non-null `pushToken`.
4. Live booking → both Android devices receive the push (not the stale iPhone).

---

## Not the cause (ruled out)
- Registration IS called every launch (keyed on `isSignedIn`; no AsyncStorage skip-flag).
- `Device.isDevice` is `true` on real phones (only skips emulators).
- `getPermissionsAsync` reads live OS state, not a cached AsyncStorage value.
- Android notification channel is created correctly (affects display, not registration).
- The `/api/user/push-token` endpoint and the POST body are correct — just never reached.
