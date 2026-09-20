// src/app/components/CheckoutButton.tsx
import React, { useState } from 'react';
import { Alert, TouchableOpacity, View, Text, ActivityIndicator } from 'react-native';
import { initiateCheckout, confirmBooking, ConfirmBookingError, CustomerInfo } from '../actions/checkout';
import { SaloonService } from '@/types';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useStripe } from '@/lib/stripe';

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
        title: 'Maksu veloitettu — vahvistus kesken',
        message:
          'Maksusi on veloitettu, mutta varauksen vahvistus ei vielä onnistunut. ' +
          'Voit yrittää vahvistamista uudelleen — sitä ei veloiteta kahdesti.',
        canRetry: true,
      };
    case 403:
      return {
        title: 'Varausta ei voitu vahvistaa',
        message:
          'Varaus ei vastaa tehtyä maksua. Uudelleenyritys ei auta. ' +
          'Ota yhteyttä asiakaspalveluun ja mainitse maksutunnus.',
        canRetry: false,
      };
    case 404:
      return {
        title: 'Varausta ei löytynyt',
        message:
          'Varausta ei löytynyt järjestelmästä. Ota yhteyttä asiakaspalveluun ja mainitse maksutunnus.',
        canRetry: false,
      };
    default:
      return {
        title: 'Vahvistus epäonnistui',
        message:
          'Maksusi on veloitettu, mutta vahvistusta ei saatu läpi. ' +
          'Tarkista verkkoyhteytesi ja yritä uudelleen — sitä ei veloiteta kahdesti.',
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
  children = "Confirm Booking"
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  
  // Use Stripe hook - this will work if the native module is available
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const handleCheckout = async () => {
    if (saloonServices.length === 0) {
      Alert.alert('Virhe', 'Valitse vähintään yksi palvelu');
      return;
    }

    if (!customerInfo.name || !customerInfo.email) {
      Alert.alert('Virhe', 'Täytä nimesi ja sähköpostiosoitteesi');
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
        throw new Error('Maksun alustus epäonnistui');
      }

      console.log('Got payment intent, initializing payment sheet...');

      // Step 2: Initialize the Payment Sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: result.paymentIntentClientSecret,
        merchantDisplayName: 'Servey',
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
        throw new Error(initError.message || 'Maksulomakkeen alustus epäonnistui');
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
        throw new Error(paymentError.message || 'Maksu epäonnistui');
      }

      // Step 4: Payment successful - confirm the booking.
      // The charge has gone through by this point, so a confirmation failure is
      // handled separately from the payment errors above: it must never surface
      // as a bare "booking failed" with no way forward.
      console.log('Payment successful, confirming booking...');

      const paymentIntentId = result.paymentIntentClientSecret.split('_secret_')[0];

      const showConfirmed = (message?: string) => {
        Alert.alert(
          'Varaus vahvistettu! 🎉',
          message || 'Varauksesi on vahvistettu. Saat vahvistusviestin sähköpostiisi.',
          [{ text: 'OK', onPress: () => onSuccess?.(result.bookingIds) }]
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
          const body = `${message}\n\nMaksutunnus: ${paymentIntentId}`;

          Alert.alert(
            title,
            body,
            canRetry
              ? [
                  { text: 'Sulje', style: 'cancel' },
                  { text: 'Yritä uudelleen', onPress: () => { void attemptConfirm(); } },
                ]
              : [{ text: 'OK' }]
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
      const errorMessage = error instanceof Error ? error.message : 'Odottamaton virhe tapahtui';
      Alert.alert('Varaus epäonnistui', errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleCheckout}
      disabled={disabled || isLoading}
      style={{ 
        backgroundColor: '#423120', 
        borderRadius: 16, 
        padding: 16, 
        shadowColor: '#423120',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        opacity: (disabled || isLoading) ? 0.6 : 1
      }}
      activeOpacity={0.8}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        {isLoading ? (
          <>
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18 }}>
              Käsitellään maksua...
            </Text>
          </>
        ) : (
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18 }}>
            {children}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const CheckoutButton: React.FC<CheckoutButtonProps> = (props) => {
  return <CheckoutButtonInner {...props} />;
};

export default CheckoutButton;
