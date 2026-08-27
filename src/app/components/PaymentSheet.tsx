// src/app/components/PaymentSheet.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Alert, ActivityIndicator, Modal, SafeAreaView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckoutResponse } from '../actions/checkout';
import PaytrailPayment from './PaytrailPayment';

interface PaymentSheetProps {
  paymentData: CheckoutResponse;
  onSuccess: (transactionId: string) => void;
  onError: (error: Error) => void;
  onCancel: () => void;
}

const PaymentForm: React.FC<PaymentSheetProps> = ({
  paymentData,
  onSuccess,
  onError,
  onCancel
}) => {
  const [isLoading, setIsLoading] = useState(false);

  // Handle deep linking for payment return
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      console.log('Deep link received:', url);
      
      // Check if this is a payment success/cancel URL
      if (url.includes('/payment/success')) {
        onSuccess(paymentData.transactionId);
      } else if (url.includes('/payment/cancel')) {
        onCancel();
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [paymentData.transactionId, onSuccess, onCancel]);

  return (
    <View style={{ flex: 1 }}>
      <PaytrailPayment
        paymentData={paymentData}
        onSuccess={onSuccess}
        onError={onError}
        onCancel={onCancel}
      />
    </View>
  );
};

export const PaymentSheet: React.FC<PaymentSheetProps> = (props) => {
  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F4EDE5' }}>
        <PaymentForm {...props} />
      </SafeAreaView>
    </Modal>
  );
};

export default PaymentSheet;