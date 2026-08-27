// src/app/(app)/success.tsx
import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function SuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bookingIds?: string;
    saloonName?: string;
    serviceName?: string;
    bookingDate?: string;
    bookingTime?: string;
    totalAmount?: string;
  }>();

  const handleViewBookings = () => {
    // Use replace to avoid navigation stack issues
    router.replace('/(tabs)/profile');
  };

  const handleBookAnother = () => {
    // Use replace to navigate to home without popping stack
    router.replace('/(tabs)/');
  };

  const totalAmount = params.totalAmount ? parseFloat(params.totalAmount) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4EDE5' }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        {/* Success Icon */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#4CAF50',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16
          }}>
            <Ionicons name="checkmark" size={40} color="#FFFFFF" />
          </View>
          <Text style={{
            fontSize: 28,
            fontWeight: 'bold',
            color: '#423120',
            textAlign: 'center',
            marginBottom: 8
          }}>
            Varausaikataulut 🎉
          </Text>
          <Text style={{
            fontSize: 16,
            color: '#666666',
            textAlign: 'center',
            lineHeight: 24
          }}>
            Your appointment has been successfully booked. You will receive a confirmation email shortly.
          </Text>
        </View>

        {/* Booking Details */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          shadowColor: '#423120',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
          borderWidth: 1,
          borderColor: '#E0D7CA'
        }}>
          <Text style={{
            fontSize: 20,
            fontWeight: 'bold',
            color: '#423120',
            marginBottom: 16,
            textAlign: 'center'
          }}>
            Varaustiedot
          </Text>

          {params.saloonName && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: '#666666', marginBottom: 4 }}>Salon</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#423120' }}>{params.saloonName}</Text>
            </View>
          )}

          {params.serviceName && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: '#666666', marginBottom: 4 }}>Service</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#423120' }}>{params.serviceName}</Text>
            </View>
          )}

          {params.bookingDate && params.bookingTime && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: '#666666', marginBottom: 4 }}>Date & Time</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#423120' }}>
                {new Date(params.bookingDate).toLocaleDateString()} at {params.bookingTime}
              </Text>
            </View>
          )}

          {totalAmount > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: '#666666', marginBottom: 4 }}>Amount</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#423120' }}>
                €{totalAmount.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Pay at Venue Notice */}
        <View style={{
          backgroundColor: '#E8F5E8',
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          borderWidth: 1,
          borderColor: '#4CAF50'
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="card-outline" size={20} color="#2E7D32" style={{ marginRight: 8 }} />
            <Text style={{
              fontSize: 16,
              fontWeight: 'bold',
              color: '#2E7D32'
            }}>
              Payment Information
            </Text>
          </View>
          <Text style={{
            fontSize: 14,
            color: '#2E7D32',
            lineHeight: 20
          }}>
            Please pay €{totalAmount.toFixed(2)} directly at the salon when you arrive for your appointment. 
            Payment can be made with cash or card.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={handleViewBookings}
            style={{
              backgroundColor: '#423120',
              paddingVertical: 16,
              paddingHorizontal: 32,
              borderRadius: 12,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 3
            }}
          >
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#FFFFFF'
            }}>
              View My Bookings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleBookAnother}
            style={{
              backgroundColor: 'transparent',
              paddingVertical: 16,
              paddingHorizontal: 32,
              borderRadius: 12,
              alignItems: 'center',
              borderWidth: 2,
              borderColor: '#423120'
            }}
          >
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#423120'
            }}>
              Book Another Service
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}