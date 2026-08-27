import React from 'react';
import { View, Text, Alert } from 'react-native';
import { router } from 'expo-router';
import { Button, ButtonText } from '@/components/ui/button';

export default function CancelScreen() {
  const handleGoBack = () => {
    router.back();
  };

  const handleGoHome = () => {
    router.replace('/(app)');
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
        Payment Cancelled
      </Text>
      <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 30 }}>
        Your payment was cancelled. No charges have been made to your account.
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          onPress={handleGoBack}
          size="md"
          variant="outline"
          action="secondary"
        >
          <ButtonText>Try Again</ButtonText>
        </Button>
        <Button
          onPress={handleGoHome}
          size="md"
          variant="solid"
          action="primary"
        >
          <ButtonText>Go Home</ButtonText>
        </Button>
      </View>
    </View>
  );
}
