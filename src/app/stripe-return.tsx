import { Redirect } from 'expo-router';

// Stripe onboarding hands back to the app with kosmiks://stripe-return. The
// in-app browser normally catches that link itself; if the system opens it
// instead, land on the payouts tab.
export default function StripeReturn() {
  return <Redirect href={'/(provider)/payouts' as any} />;
}
