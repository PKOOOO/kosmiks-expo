// src/app/components/CheckoutButton.tsx
import React, { useState } from 'react';
import { Alert, TouchableOpacity, View, Text, ActivityIndicator } from 'react-native';
import { initiateCheckout, confirmBooking, ConfirmBookingError, CustomerInfo } from '../actions/checkout';
import { SaloonService } from '@/types';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { initStripe, useStripe } from '@/lib/stripe';
import { describeError } from '@/lib/api';
import { isOfflineNow } from '@/lib/network';
import { useT, tr } from '@/i18n';

/** Errors whose message is safe to show as-is (Stripe's payment sheet copy). */
class UserFacingError extends Error {}

interface CheckoutButtonProps {
  saloonServices: SaloonService[];
  customerInfo: CustomerInfo;
  onSuccess?: (bookingIds: string[]) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * How to present a confirmation failure. By this point the card HAS been
 * charged, so a bare "booking failed" is both inaccurate and a dead end.
 *
 * `canRetry` reflects whether retrying can actually succeed. Confirmation is
 * idempotent server-side (only pending bookings transition, and re-confirming
 * sends no duplicate emails or pushes), so retrying is always safe — it is just
 * pointless for a definitive mismatch.
 */
const describeConfirmFailure = (status?: number): {
  title: string;
  message: string;
  canRetry: boolean;
} => {
  switch (status) {
    case 402:
      return {
        title: tr('checkout.paidPending'),
        message: tr('checkout.paidPendingBody'),
        canRetry: true,
      };
    case 403:
      return {
        title: tr('checkout.mismatch'),
        message: tr('checkout.mismatchBody'),
        canRetry: false,
      };
    case 404:
      return {
        title: tr('checkout.notFound'),
        message: tr('checkout.notFoundBody'),
        canRetry: false,
      };
    default:
      return {
        title: tr('checkout.confirmFailed'),
        message: tr('checkout.confirmFailedBody'),
        canRetry: true,
      };
  }
};

const CheckoutButtonInner: React.FC<CheckoutButtonProps> = ({
  saloonServices,
  customerInfo,
  onSuccess,
  onError,
  disabled = false,
  children
}) => {
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(false);
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  
  // Use Stripe hook - this will work if the native module is available
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const handleCheckout = async () => {
    if (saloonServices.length === 0) {
      Alert.alert(t('common.error'), t('checkout.selectService'));
      return;
    }

    if (!customerInfo.name || !customerInfo.email) {
      Alert.alert(t('common.error'), t('checkout.fillDetails'));
      return;
    }

    // Don't start a payment we can't finish.
    if (await isOfflineNow()) {
      Alert.alert(t('checkout.offline'), t('checkout.offlineBody'));
      return;
    }

    // If not signed in, go to sign-in and then resume
    if (!isSignedIn) {
      router.push({
        pathname: '/sign-in',
        params: {
          redirect: 'checkout',
        },
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get auth token
      const authToken = await getToken();
      const customerInfoWithUserId = {
        ...customerInfo,
        userId: user?.id,
      };

      // Step 1: Create checkout session and get payment intent
      console.log('Creating checkout session...');
      const result = await initiateCheckout(saloonServices, customerInfoWithUserId, authToken || undefined);
      
      if (!result.paymentIntentClientSecret) {
        throw new Error(t('checkout.initFailed'));
      }

      console.log('Got payment intent, initializing payment sheet...');

      // Use the Stripe account the server created the payment in. The key
      // built into the app can be out of date after a Stripe account switch,
      // and then the payment sheet can't find the payment.
      if (result.publishableKey) {
        await initStripe({
          publishableKey: result.publishableKey,
          merchantIdentifier: 'merchant.com.kosmiks.app',
          urlScheme: 'kosmiks',
        });
      }

      // Step 2: Initialize the Payment Sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: result.paymentIntentClientSecret,
        merchantDisplayName: 'Kosmiks',
        allowsDelayedPaymentMethods: false,
        customFlow: false, // Explicitly set to avoid native crashes
        defaultBillingDetails: {
          name: customerInfo.name,
          email: customerInfo.email,
          phone: customerInfo.phone,
        },
      });

      if (initError) {
        console.error('Error initializing payment sheet:', initError);
        throw new UserFacingError(initError.message || t('checkout.sheetFailed'));
      }

      console.log('Payment sheet initialized, presenting...');

      // Step 3: Present the Payment Sheet
      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        if (paymentError.code === 'Canceled') {
          console.log('Payment canceled by user');
          setIsLoading(false);
          return;
        }
        console.error('Payment failed:', paymentError);
        throw new UserFacingError(paymentError.message || t('checkout.paymentFailed'));
      }

      // Step 4: Payment successful - confirm the booking.
      // The charge has gone through by this point, so a confirmation failure is
      // handled separately from the payment errors above: it must never surface
      // as a bare "booking failed" with no way forward.
      console.log('Payment successful, confirming booking...');

      const paymentIntentId = result.paymentIntentClientSecret.split('_secret_')[0];

      const showConfirmed = (_serverMessage?: string) => {
        Alert.alert(
          t('checkout.confirmed'),
          t('checkout.confirmedBody'),
          [{ text: t('common.ok'), onPress: () => onSuccess?.(result.bookingIds) }]
        );
      };

      const attemptConfirm = async (): Promise<void> => {
        // Retries are fired from an Alert button, i.e. after handleCheckout's
        // `finally` has already cleared isLoading. Drive it here so a retry
        // shows the spinner too, instead of appearing to do nothing.
        setIsLoading(true);
        try {
          const confirmResult = await confirmBooking(
            result.bookingIds,
            paymentIntentId,
            authToken || undefined
          );
          showConfirmed(confirmResult.message);
        } catch (confirmError) {
          const status =
            confirmError instanceof ConfirmBookingError ? confirmError.status : undefined;
          const { title, message, canRetry } = describeConfirmFailure(status);

          console.error('Confirm failed:', { status, paymentIntentId });

          // Always give the customer the payment reference — it is what support
          // needs to reconcile a charge against a missing booking.
          const body = `${message}\n\n${t('checkout.paymentRef', { id: paymentIntentId })}`;

          Alert.alert(
            title,
            body,
            canRetry
              ? [
                  { text: t('common.close'), style: 'cancel' },
                  { text: t('common.retry'), onPress: () => { void attemptConfirm(); } },
                ]
              : [{ text: t('common.ok') }]
          );

          onError?.(
            confirmError instanceof Error ? confirmError : new Error(String(confirmError))
          );
        } finally {
          setIsLoading(false);
        }
      };

      await attemptConfirm();
    } catch (error) {
      console.error('Checkout error:', error);
      // Before payment succeeded: nothing was charged. Stripe's messages are
      // written for customers; anything else gets friendly copy, never the
      // raw error text.
      const message = error instanceof UserFacingError ? error.message : describeError(error).message;
      Alert.alert(t('checkout.bookingFailed'), `${message}\n\n${t('checkout.notCharged')}`);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  // Disabled fade lives on a wrapper: TouchableOpacity keeps the opacity it
  // mounted with, so a button that starts disabled (e.g. before the user's
  // name has loaded) would otherwise stay faded once it becomes enabled.
  return (
    <View style={{ opacity: (disabled || isLoading) ? 0.6 : 1 }}>
    <TouchableOpacity
      onPress={handleCheckout}
      disabled={disabled || isLoading}
      style={{
        backgroundColor: '#423120',
        borderRadius: 27,
        height: 54,
        paddingHorizontal: 18,
        justifyContent: 'center',
        shadowColor: '#423120',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
      }}
      activeOpacity={0.8}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        {isLoading ? (
          <>
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFFFFF', fontFamily: 'Philosopher-Bold', fontSize: 16 }}>
              {t('checkout.processing')}
            </Text>
          </>
        ) : (
          <Text style={{ color: '#FFFFFF', fontFamily: 'Philosopher-Bold', fontSize: 16 }}>
            {children ?? t('checkout.confirmBooking')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
    </View>
  );
};

export const CheckoutButton: React.FC<CheckoutButtonProps> = (props) => {
  return <CheckoutButtonInner {...props} />;
};

export default CheckoutButton;
