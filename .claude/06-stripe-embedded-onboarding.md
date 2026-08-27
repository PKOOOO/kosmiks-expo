---
description: Stripe Connect embedded onboarding — fully native in app, no browser redirect
globs: ["**/app/(provider)/payouts.tsx", "**/api/stripe/**"]
alwaysApply: false
---

# Provider Screen: Stripe Payouts (Embedded Onboarding)

## Goal
Provider fills in Finnish bank details and business info directly inside the app.
No browser redirect. No WebView. Uses Stripe Connect Embedded Components.

---

## Backend — `cosmix-admin`

### New route: `app/api/stripe/account-session/route.ts`

```ts
import { stripe } from '@/lib/stripe'
import { checkAdminAccess } from '@/lib/admin-access'
import prisma from '@/lib/prisma'

// GET — check current Stripe account status
export async function GET(req: Request) {
  const { user } = await checkAdminAccess(req)
  const saloon = await prisma.saloon.findFirst({
    where: { ownerId: user.id },
    select: { stripeAccountId: true }
  })

  if (!saloon?.stripeAccountId) {
    return Response.json({ status: 'not_connected' })
  }

  const account = await stripe.accounts.retrieve(saloon.stripeAccountId)
  return Response.json({
    status: account.details_submitted ? 'active' : 'incomplete',
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
  })
}

// POST — create or retrieve account + return AccountSession client_secret
export async function POST(req: Request) {
  const { user } = await checkAdminAccess(req)
  
  let saloon = await prisma.saloon.findFirst({
    where: { ownerId: user.id },
    select: { id: true, stripeAccountId: true }
  })

  // Create Stripe account if provider doesn't have one yet
  if (!saloon?.stripeAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'FI',
      email: user.emailAddresses[0].emailAddress,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })

    await prisma.saloon.update({
      where: { id: saloon!.id },
      data: { stripeAccountId: account.id }
    })

    saloon = { ...saloon!, stripeAccountId: account.id }
  }

  // Create embedded AccountSession
  const accountSession = await stripe.accountSessions.create({
    account: saloon.stripeAccountId!,
    components: {
      account_onboarding: { enabled: true },
    },
  })

  return Response.json({ client_secret: accountSession.client_secret })
}
```

---

## Mobile — `cosmix-v2`

### File: `src/app/(provider)/payouts.tsx`

```tsx
import { ConnectAccountOnboarding, ConnectComponentsProvider } from '@stripe/react-native'
// Note: verify exact import from @stripe/stripe-react-native docs

export default function PayoutsScreen() {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<'loading'|'not_connected'|'incomplete'|'active'>('loading')
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    const token = await getToken()
    const res = await fetch(`${API_URL}/api/stripe/account-session`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    setStatus(data.status)
  }

  const startOnboarding = async () => {
    const token = await getToken()
    const res = await fetch(`${API_URL}/api/stripe/account-session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    const { client_secret } = await res.json()
    setClientSecret(client_secret)
  }

  if (status === 'active') {
    return <ActivePayoutsView />  // show payout status, green badge
  }

  if (clientSecret) {
    return (
      <ConnectComponentsProvider
        connectInstance={{ /* stripe connect instance with client_secret */ }}
      >
        <ConnectAccountOnboarding
          onExit={() => { setClientSecret(null); checkStatus() }}
        />
      </ConnectComponentsProvider>
    )
  }

  return (
    <View>
      <Text>Set up your payouts to receive money from bookings</Text>
      <Button title="Set up payouts" onPress={startOnboarding} />
    </View>
  )
}
```

---

## Rules
- Check `@stripe/stripe-react-native` docs for exact `ConnectComponentsProvider` API
- The `client_secret` from AccountSession expires — fetch a fresh one each time
- On `onExit`, always re-check status (provider may have partially completed)
- `active` state should show: chargesEnabled ✅, payoutsEnabled ✅, next payout estimate
- Never hardcode Stripe keys — use env vars only
- The `stripeAccountId` must be saved to the DB after account creation
