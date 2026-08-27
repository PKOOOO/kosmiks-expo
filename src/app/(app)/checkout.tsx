// src/app/(app)/checkout.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckoutButton } from '../components/CheckoutButton';
import { CustomerInfo } from '../actions/checkout';
import { SaloonService } from '@/app/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import TimeSlotPicker, { ConfirmBookingTimeButton } from '../components/TimeSlotPicker';
import Header from '../components/Header';
import SideMenu from '../components/SideMenu';
import ReviewsSection from '../components/ReviewsSection';
import { useAuth, useUser } from '@clerk/clerk-expo';


export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const params = useLocalSearchParams<{
    saloonId?: string;
    saloonName?: string;
    serviceId?: string;
    serviceName?: string;
    categoryName?: string;
    price?: string;
    durationMinutes?: string;
    workType?: string;
    date?: string;
    time?: string;
  }>();

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: user?.fullName || user?.firstName || '',
    email: user?.primaryEmailAddress?.emailAddress || '',
    phone: '',
    bookingTime: new Date().toISOString(),
    notes: ''
  });

  // Keep customerInfo in sync with Clerk user after sign-in
  useEffect(() => {
    if (user) {
      setCustomerInfo(prev => ({
        ...prev,
        name: user.fullName || user.firstName || prev.name,
        email: user.primaryEmailAddress?.emailAddress || prev.email,
      }));
    }
  }, [user]);

  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [isProcessingBooking, setIsProcessingBooking] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);
  // Slot highlighted in the picker but not yet confirmed. Held here because the
  // confirm button lives outside the ScrollView, pinned to the screen bottom.
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);

  // Create SaloonService object from params using useMemo to prevent infinite re-renders
  const saloonService = useMemo(() => {
    if (params.saloonId && params.serviceId && params.price && params.durationMinutes) {
      return {
        saloonId: params.saloonId,
        serviceId: params.serviceId,
        price: parseFloat(params.price),
        durationMinutes: parseInt(params.durationMinutes),
        isAvailable: true,
        saloon: {
          id: params.saloonId,
          name: params.saloonName || 'Unknown Salon',
          userId: 'user-1', // You might want to get this from the API
          rating: 4.5, // You might want to get this from the API
        },
        service: {
          id: params.serviceId,
          name: params.serviceName || 'Unknown Service',
          description: `${params.serviceName} at ${params.saloonName}`,
          categoryId: 'cat-1', // You might want to get this from the API
          isPopular: false,
        }
      } as SaloonService;
    }
    return null;
  }, [params.saloonId, params.serviceId, params.price, params.durationMinutes, params.saloonName, params.serviceName]);

  // Hydrate booking time from URL params after sign-in redirect
  useEffect(() => {
    const pDate = typeof params.date === 'string' && params.date.length > 0 ? params.date : null;
    const pTime = typeof params.time === 'string' && params.time.length > 0 ? params.time : null;
    if (pDate && pTime && !bookingConfirmed) {
      const datetime = new Date(`${pDate}T${pTime}:00`).toISOString();
      setCustomerInfo(prev => ({ ...prev, bookingTime: datetime }));
      setBookingConfirmed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.date, params.time]);

  const handleSuccess = (bookingIds: string[]) => {
    console.log('Booking successful:', { bookingIds });
    setIsProcessingBooking(false);

    // Navigate to profile to view bookings without using POP_TO_TOP
    router.replace('/(tabs)/profile');
  };

  const handleError = (error: Error) => {
    console.error('Booking error:', error);
    setIsProcessingBooking(false);
  };

  const handleSlotConfirm = (datetime: string) => {
    setCustomerInfo(prev => ({ ...prev, bookingTime: datetime }));
    setBookingConfirmed(true);
  };

  // Use the selected saloon service - no mock data, require real service
  const servicesToDisplay = saloonService ? [saloonService] : [];
  const totalPrice = servicesToDisplay.reduce((sum, service) => sum + service.price, 0);
  const totalDuration = servicesToDisplay.reduce((sum, service) => sum + service.durationMinutes, 0);

  // Check if all customer info is filled from Clerk profile
  const isCustomerInfoComplete = customerInfo.name && customerInfo.email;

  const showTimePicker = !bookingConfirmed && !!params.saloonId && !!params.serviceId;
  // RN's SafeAreaView already insets the bottom on iOS, so only Android needs
  // the gesture/nav-bar inset added on top of the footer padding.
  const footerInset = Platform.OS === 'android' ? insets.bottom : 0;

  // Show error if no service is selected
  if (!saloonService) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F4EDE5' }}>
        <Header title="SERVEY" showBack={true} showMenu={true} onBackPress={() => router.back()} onMenuPress={() => setMenuVisible(true)} disableSafeAreaPadding={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={64} color="#423120" style={{ marginBottom: 16, opacity: 0.5 }} />
          <Text style={{ fontSize: 18, fontFamily: 'Philosopher-Bold', color: '#423120', textAlign: 'center', marginBottom: 8 }}>
            Palvelua ei valittu
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'Philosopher-Regular', color: '#423120', opacity: 0.7, textAlign: 'center', marginBottom: 24 }}>
            Valitse palvelu jatkaaksesi varausta
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: '#423120',
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontFamily: 'Philosopher-Bold', color: '#F5F1EB' }}>
              Takaisin palveluihin
            </Text>
          </TouchableOpacity>
        </View>
        <Modal
          animationType="slide"
          transparent={false}
          visible={isMenuVisible}
          onRequestClose={() => setMenuVisible(false)}
          statusBarTranslucent={true}
        >
          <SideMenu onClose={() => setMenuVisible(false)} />
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {/* Header */}
      <Header title="SERVEY" showBack={true} showMenu={true} onBackPress={() => router.back()} onMenuPress={() => setMenuVisible(true)} disableSafeAreaPadding={true} />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        // Leave room for the pinned confirm button so it never covers content.
        contentContainerStyle={{ paddingBottom: (showTimePicker ? 112 : 24) + insets.bottom }}
      >
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, alignContent: 'center', justifyContent: 'center', marginTop: 24 }}>



          {/* Selected Services */}
          <View style={{ marginBottom: 24 }}>

            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 20,
              shadowColor: '#423120',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
              borderWidth: 3,
              borderColor: '#E0D7CA'
            }}>
              {servicesToDisplay.map((service, index) => (
                <View key={index} style={{
                  paddingBottom: 0,
                  borderBottomWidth: index < servicesToDisplay.length - 1 ? 1 : 0,
                  borderBottomColor: '#E0D7CA',
                  marginBottom: index < servicesToDisplay.length - 1 ? 16 : 0
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 18,
                        fontWeight: '600',
                        color: '#423120',
                        marginBottom: 4
                      }}>
                        {(() => {
                          const name = service.service?.name || '';
                          const splitIndex = name.indexOf('(');

                          if (splitIndex !== -1) {
                            const mainPart = name.substring(0, splitIndex).trim();
                            const subPart = name.substring(splitIndex).trim();

                            return (
                              <>
                                {mainPart}
                                {'\n'}
                                <Text style={{ fontSize: 16 }}>
                                  {subPart}
                                </Text>
                              </>
                            );
                          }

                          return name;
                        })()}
                      </Text>
                      {params.workType && (
                        <Text style={{
                          fontSize: 16,
                          color: '#423120',
                          fontFamily: 'Philosopher-Bold',
                          marginBottom: 4
                        }}>
                          {(() => {
                            const formatted = params.workType.replace(/_/g, ' ').toLowerCase();
                            const sentenceCase = formatted.charAt(0).toUpperCase() + formatted.slice(1);
                            return `(${sentenceCase})`;
                          })()}
                        </Text>
                      )}
                      <Text style={{ fontSize: 14, color: '#423120', opacity: 0.7, fontFamily: 'Philosopher-Regular', marginBottom: 2 }}>
                        {service.saloon?.name}
                      </Text>
                      <Text style={{
                        fontSize: 12,
                        color: '#423120',
                        opacity: 0.6
                      }}>

                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '600',
                      color: '#423120'
                    }}>
                    </Text>
                  </View>
                </View>
              ))}

              <View style={{
                paddingTop: 16,
                borderTopWidth: 2,
                borderTopColor: '#E0D7CA'
              }}>
                {/* <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 8
                }}>
                  <Text style={{
                    fontSize: 14,
                    color: '#423120',
                    opacity: 0.7
                  }}>
                    Duration:
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#423120'
                  }}>
                    {totalDuration} minutes
                  </Text>
                </View> */}
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#423120'
                  }}>
                    Kokonaismäärä:
                  </Text>
                  <Text style={{
                    fontSize: 24,
                    fontWeight: 'bold',
                    color: '#423120'
                  }}>
                    €{totalPrice.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Step 2: Time slot picker — its confirm button is pinned below */}
          {showTimePicker && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{
                fontSize: 16,
                fontFamily: 'Philosopher-Bold',
                color: '#423120',
                marginBottom: 14,
              }}>
                Valitse aika
              </Text>
              <TimeSlotPicker
                saloonId={params.saloonId!}
                serviceId={params.serviceId!}
                onConfirm={handleSlotConfirm}
                showConfirmButton={false}
                onSelectionChange={setPendingSlot}
              />
            </View>
          )}

          {/* Step 3: Payment */}
          {bookingConfirmed && (
            <View style={{ marginBottom: 32 }}>
              {/* Selected time summary */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F4EDE5',
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
                gap: 8,
              }}>
                <Ionicons name="checkmark-circle" size={18} color="#423120" />
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: '#423120', flex: 1 }}>
                  {new Date(customerInfo.bookingTime).toLocaleString('fi-FI', {
                    weekday: 'short', day: 'numeric', month: 'short',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
                <TouchableOpacity onPress={() => setBookingConfirmed(false)}>
                  <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#888' }}>
                    Muuta
                  </Text>
                </TouchableOpacity>
              </View>

              {isSignedIn ? (
                <CheckoutButton
                  saloonServices={servicesToDisplay}
                  customerInfo={customerInfo}
                  onSuccess={handleSuccess}
                  onError={handleError}
                  disabled={!isCustomerInfoComplete}
                >
                  Vahvista varaus
                </CheckoutButton>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    const dt = new Date(customerInfo.bookingTime);
                    const date = dt.toISOString().split('T')[0];
                    const time = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
                    const search = new URLSearchParams({
                      ...(params.saloonId ? { saloonId: String(params.saloonId) } : {}),
                      ...(params.saloonName ? { saloonName: String(params.saloonName) } : {}),
                      ...(params.serviceId ? { serviceId: String(params.serviceId) } : {}),
                      ...(params.serviceName ? { serviceName: String(params.serviceName) } : {}),
                      ...(params.categoryName ? { categoryName: String(params.categoryName) } : {}),
                      ...(params.price ? { price: String(params.price) } : {}),
                      ...(params.durationMinutes ? { durationMinutes: String(params.durationMinutes) } : {}),
                      date,
                      time,
                    }).toString();
                    router.push({ pathname: '/sign-in', params: { redirect: encodeURIComponent(`/(app)/checkout?${search}`) } });
                  }}
                  style={{
                    backgroundColor: '#423120',
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18, fontFamily: 'Philosopher-Bold', color: '#F5F1EB' }}>
                    Kirjaudu sisään varaukseen
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Reviews Section */}
          {params.saloonId && (
            <ReviewsSection saloonId={params.saloonId} />
          )}
        </View>
      </ScrollView>

      {/* Sticky confirm bar — sibling of the ScrollView, so it stays put on scroll */}
      {showTimePicker && (
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 12 + footerInset,
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E0D7CA',
            shadowColor: '#423120',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 12,
          }}
        >
          <ConfirmBookingTimeButton
            enabled={!!pendingSlot}
            onPress={() => pendingSlot && handleSlotConfirm(pendingSlot)}
          />
        </View>
      )}

      {/* Modal for the side menu */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isMenuVisible}
        onRequestClose={() => setMenuVisible(false)}
        statusBarTranslucent={true}
      >
        <SideMenu onClose={() => setMenuVisible(false)} />
      </Modal>
    </SafeAreaView>
  );
}
