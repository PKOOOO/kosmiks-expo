// src/app/components/PaytrailPaymentSheet.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Alert, ActivityIndicator, Modal, SafeAreaView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckoutResponse } from '../actions/checkout';
import PaytrailPayment from './PaytrailPayment';

interface PaytrailPaymentSheetProps {
  paymentData: CheckoutResponse;
  onSuccess: (transactionId: string) => void;
  onError: (error: Error) => void;
  onCancel: () => void;
  visible: boolean;
}

export const PaytrailPaymentSheet: React.FC<PaytrailPaymentSheetProps> = ({
  paymentData,
  onSuccess,
  onError,
  onCancel,
  visible
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

  const handlePaymentSuccess = (transactionId: string) => {
    setIsLoading(false);
    onSuccess(transactionId);
  };

  const handlePaymentError = (error: Error) => {
    setIsLoading(false);
    onError(error);
  };

  const handlePaymentCancel = () => {
    setIsLoading(false);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F4EDE5' }}>
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#E5E5E5'
        }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#423120' }}>
            Payment
          </Text>
          <TouchableOpacity onPress={onCancel}>
            <Ionicons name="close" size={24} color="#423120" />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
          <PaytrailPayment
            paymentData={paymentData}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onCancel={handlePaymentCancel}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default PaytrailPaymentSheet;
