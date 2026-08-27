// src/app/components/ServiceBooking.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { CheckoutButton } from './CheckoutButton';
import { CustomerInfo } from '../actions/checkout';
import { SaloonService } from '@/app/types';

interface ServiceBookingProps {
  saloonServices: SaloonService[];
  onBookingComplete?: (bookingIds: string[]) => void;
}

export const ServiceBooking: React.FC<ServiceBookingProps> = ({
  saloonServices,
  onBookingComplete
}) => {
  const [selectedServices, setSelectedServices] = useState<SaloonService[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    email: '',
    phone: '',
    bookingTime: new Date().toISOString(),
    notes: ''
  });

  const toggleService = (service: SaloonService) => {
    setSelectedServices(prev => {
      const isSelected = prev.some(s => 
        s.saloonId === service.saloonId && s.serviceId === service.serviceId
      );
      
      if (isSelected) {
        return prev.filter(s => 
          !(s.saloonId === service.saloonId && s.serviceId === service.serviceId)
        );
      } else {
        return [...prev, service];
      }
    });
  };

  const isServiceSelected = (service: SaloonService) => {
    return selectedServices.some(s => 
      s.saloonId === service.saloonId && s.serviceId === service.serviceId
    );
  };

  const totalPrice = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const totalDuration = selectedServices.reduce((sum, service) => sum + service.durationMinutes, 0);

  const handleCheckoutSuccess = (sessionId: string, bookingIds: string[]) => {
    console.log('Booking successful:', { sessionId, bookingIds });
    Alert.alert('Success', 'Your booking has been created successfully!');
    onBookingComplete?.(bookingIds);
    
    // Reset form
    setSelectedServices([]);
    setCustomerInfo({
      name: '',
      email: '',
      phone: '',
      bookingTime: new Date().toISOString(),
      notes: ''
    });
  };

  const handleCheckoutError = (error: Error) => {
    console.error('Booking error:', error);
    Alert.alert('Error', 'Failed to create booking. Please try again.');
  };

  return (
    <View style={{ padding: 16 }}>
      {/* Service Selection */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#423120' }}>
          Select Services
        </Text>
        
        {saloonServices.map((service, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => toggleService(service)}
            style={{
              padding: 16,
              marginBottom: 8,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: isServiceSelected(service) ? '#423120' : '#E0D7CA',
              backgroundColor: isServiceSelected(service) ? '#F4EDE5' : 'white',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  fontSize: 16, 
                  fontWeight: 'bold', 
                  color: '#423120',
                  marginBottom: 4 
                }}>
                  {service.service?.name}
                </Text>
                <Text style={{ 
                  fontSize: 14, 
                  color: '#968469',
                  marginBottom: 2 
                }}>
                  {service.saloon?.name}
                </Text>
                <Text style={{ 
                  fontSize: 12, 
                  color: '#968469' 
                }}>
                  {service.durationMinutes} minutes
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: 'bold', 
                  color: '#423120' 
                }}>
                  ${service.price.toFixed(2)}
                </Text>
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: isServiceSelected(service) ? '#423120' : '#E0D7CA',
                  backgroundColor: isServiceSelected(service) ? '#423120' : 'transparent',
                  marginTop: 4
                }} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Customer Information */}
      {selectedServices.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#423120' }}>
            Your Information
          </Text>
          
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 14, color: '#423120', marginBottom: 4 }}>Full Name *</Text>
            <View style={{ 
              borderWidth: 1, 
              borderColor: '#E0D7CA', 
              borderRadius: 8, 
              padding: 12,
              backgroundColor: 'white'
            }}>
              <Text style={{ color: '#423120' }}>
                {customerInfo.name || 'Enter your full name'}
              </Text>
            </View>
          </View>

          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 14, color: '#423120', marginBottom: 4 }}>Email *</Text>
            <View style={{ 
              borderWidth: 1, 
              borderColor: '#E0D7CA', 
              borderRadius: 8, 
              padding: 12,
              backgroundColor: 'white'
            }}>
              <Text style={{ color: '#423120' }}>
                {customerInfo.email || 'Enter your email'}
              </Text>
            </View>
          </View>

          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 14, color: '#423120', marginBottom: 4 }}>Phone *</Text>
            <View style={{ 
              borderWidth: 1, 
              borderColor: '#E0D7CA', 
              borderRadius: 8, 
              padding: 12,
              backgroundColor: 'white'
            }}>
              <Text style={{ color: '#423120' }}>
                {customerInfo.phone || 'Enter your phone number'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Summary */}
      {selectedServices.length > 0 && (
        <View style={{ 
          padding: 16, 
          backgroundColor: '#F4EDE5', 
          borderRadius: 12, 
          marginBottom: 20 
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#423120', marginBottom: 8 }}>
            Booking Summary
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: '#968469' }}>Services:</Text>
            <Text style={{ color: '#423120' }}>{selectedServices.length}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: '#968469' }}>Total Duration:</Text>
            <Text style={{ color: '#423120' }}>{totalDuration} minutes</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#423120' }}>Total Price:</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#423120' }}>
              ${totalPrice.toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {/* Checkout Button */}
      {selectedServices.length > 0 && (
        <CheckoutButton
          saloonServices={selectedServices}
          customerInfo={customerInfo}
          onSuccess={handleCheckoutSuccess}
          onError={handleCheckoutError}
        >
          Book & Pay ${totalPrice.toFixed(2)}
        </CheckoutButton>
      )}
    </View>
  );
};

export default ServiceBooking;
