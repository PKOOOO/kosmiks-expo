// src/app/components/PaytrailPayment.tsx
import React, { useState } from 'react';
import { Alert, View, Text, Linking, ActivityIndicator } from 'react-native';
import { Button, ButtonText } from '@/components/ui/button';
import { CheckoutResponse } from '../actions/checkout';

interface PaytrailPaymentProps {
  paymentData: CheckoutResponse;
  onSuccess: (transactionId: string) => void;
  onError: (error: Error) => void;
  onCancel: () => void;
}

export const PaytrailPayment: React.FC<PaytrailPaymentProps> = ({
  paymentData,
  onSuccess,
  onError,
  onCancel
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    setIsLoading(true);

    try {
      // Open Paytrail payment URL in browser
      const supported = await Linking.canOpenURL(paymentData.paymentUrl);
      
      if (!supported) {
        throw new Error('Cannot open payment URL');
      }

      // Open the payment URL
      await Linking.openURL(paymentData.paymentUrl);
      
      // Note: In a real implementation, you would need to handle the return URL
      // and verify payment status through webhooks or polling
      // For now, we'll assume success after opening the URL
      onSuccess(paymentData.transactionId);
      
    } catch (err) {
      console.error('Payment error:', err);
      onError(err instanceof Error ? err : new Error('Failed to open payment URL'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
        Complete Payment with Paytrail
      </Text>
      <Text style={{ fontSize: 16, marginBottom: 8 }}>
        Amount: €{(paymentData.amount).toFixed(2)}
      </Text>
      <Text style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
        You will be redirected to Paytrail's secure payment page where you can pay using Finnish banks, cards, or mobile payments.
      </Text>
      
      <Button
        onPress={handlePayment}
        isDisabled={isLoading}
        size="lg"
        variant="solid"
        action="primary"
        style={{ marginBottom: 12 }}
      >
        <ButtonText>
          {isLoading ? 'Opening Payment...' : `Pay €${paymentData.amount.toFixed(2)}`}
        </ButtonText>
      </Button>

      <Button
        onPress={onCancel}
        isDisabled={isLoading}
        size="lg"
        variant="outline"
        action="secondary"
      >
        <ButtonText>Cancel</ButtonText>
      </Button>
    </View>
  );
};

export default PaytrailPayment;
