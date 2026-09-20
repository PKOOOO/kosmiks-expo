import type { PropsWithChildren } from "react";

type StripeProviderProps = PropsWithChildren<{
  publishableKey: string;
  merchantIdentifier?: string;
  urlScheme?: string;
}>;

type StripeError = {
  code: string;
  message: string;
};

const unsupportedError: StripeError = {
  code: "Unsupported",
  message: "Stripe payments are available in the Servey mobile app.",
};

export function StripeProvider({ children }: StripeProviderProps) {
  return children;
}

export function useStripe() {
  return {
    initPaymentSheet: async () => ({ error: unsupportedError }),
    presentPaymentSheet: async () => ({ error: unsupportedError }),
  };
}
