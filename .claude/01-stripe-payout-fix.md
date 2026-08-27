---
description: Fix Stripe payment routing so providers actually receive money
globs: ["**/api/checkout/**", "**/stripe/**"]
alwaysApply: false
---

# Fix: Stripe Payout Routing to Providers

## Problem
`paymentIntents.create` has no `transfer_data` or `application_fee_amount`.
Providers have Stripe Express accounts but receive zero money. Payments go
entirely to the platform.

## Fix in `cosmix-admin/app/api/checkout/route.ts`

### Step 1 — Fetch provider's Stripe account before creating intent
```ts
// Get the saloon from the booking, then get the provider's stripeAccountId
const saloon = await prisma.saloon.findUnique({
  where: { id: booking.saloonId },
  select: { stripeAccountId: true }
})
```

### Step 2 — Update paymentIntents.create
```ts
const PLATFORM_FEE_PERCENT = 0.10 // 10% platform cut

const intentParams: Stripe.PaymentIntentCreateParams = {
  amount: Math.round(totalAmount * 100),
  currency: 'eur',
  automatic_payment_methods: { enabled: true },
  metadata: { bookingIds, customerEmail, customerName },
}

// Only add transfer if provider has a connected Stripe account
if (saloon?.stripeAccountId) {
  intentParams.application_fee_amount = Math.round(totalAmount * 100 * PLATFORM_FEE_PERCENT)
  intentParams.transfer_data = {
    destination: saloon.stripeAccountId,
  }
}

const paymentIntent = await stripe.paymentIntents.create(intentParams)
```

### Step 3 — Don't block booking if no Stripe account yet
If `saloon.stripeAccountId` is null, still create the booking normally.
Log a warning but do not throw an error — the customer should not be blocked.

## Rules
- Never hardcode the platform fee — use the constant
- Always handle the case where stripeAccountId is null gracefully
- Do not change the existing booking confirmation or email logic
- Test with a Stripe test account before touching production
