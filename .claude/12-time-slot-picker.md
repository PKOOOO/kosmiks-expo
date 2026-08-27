# Phase 2: Time Slot Picker (Customer Booking Flow)

**Repo:** `cosmix-v2`
**Files:** `src/app/checkout.tsx` + new `src/components/TimeSlotPicker.tsx`

## Problem
Customers go straight to checkout with no way to pick a time.
`GET /api/public/saloons/[saloonId]/available-slots` exists but is never called.

## API Call
```
GET /api/public/saloons/[saloonId]/available-slots?serviceId=<id>&date=<YYYY-MM-DD>
```

No auth required — public endpoint.

### Response (normal day)
```ts
{
  availableSlots: Array<{
    time: string,      // "09:00"
    datetime: string   // "2024-03-15T09:00:00.000Z"
  }>,
  date: string,
  saloonId: string,
  serviceId: string
}
```

### Response (closed day)
```ts
{
  availableSlots: [],
  isClosed: true,
  message: "We are closed on this day"
}
```

## New Component: `src/components/TimeSlotPicker.tsx`

```tsx
Props:
  saloonId: string
  serviceId: string
  onConfirm: (datetime: string) => void  // ISO string of selected slot
```

### UI Structure
```
Date picker row (horizontal scroll, next 14 days):
  [Mon 19] [Tue 20] [Wed 21] ...
  Selected date highlighted in dark brown

Time slots grid (2 columns):
  [09:00]  [09:30]
  [10:00]  [10:30]
  ...

If isClosed === true:
  Show: "Closed on this day" message, no slots

If availableSlots is empty (not closed):
  Show: "No available slots for this date"

[Confirm booking] button — disabled until slot selected
```

### Fetch logic
```ts
// Fetch when date changes
const fetchSlots = async (date: string) => {
  const url = `${API_URL}/api/public/saloons/${saloonId}/available-slots`
           + `?serviceId=${serviceId}&date=${date}`
  const res = await fetch(url)
  const data = await res.json()
  setSlots(data.availableSlots)
  setIsClosed(data.isClosed ?? false)
}
```

### Date format
```ts
// Convert selected date to YYYY-MM-DD for API
const formatDate = (date: Date) => date.toISOString().split('T')[0]

// Display format for date pills: "Mon 19"
const displayDate = (date: Date) => date.toLocaleDateString('en', {
  weekday: 'short', day: 'numeric'
})
```

## Wire into checkout flow

In `src/app/checkout.tsx`, before the payment sheet:
1. Show `TimeSlotPicker` as a step before payment
2. Selected `datetime` gets sent to `POST /api/checkout` as `bookingTime`
3. Only show Stripe payment sheet after slot is confirmed

### Updated checkout flow
```
Step 1: Review service + price
Step 2: Pick date + time slot  ← NEW
Step 3: Stripe payment sheet
Step 4: Confirm booking
```

## Rules
- Default selected date = today
- Only show next 14 days in the date picker
- Disable past dates
- Loading skeleton while fetching slots
- Refetch slots every time date changes
- `bookingTime` must be the full ISO `datetime` string from the slot, not just `time`
- Match beige/brown theme
