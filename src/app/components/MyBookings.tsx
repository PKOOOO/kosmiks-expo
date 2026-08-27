// src/app/components/MyBookings.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Booking } from '@/app/types';
import getBookings from '../actions/get-bookings';
import { getSalon, SalonDetails } from '../actions/get-salon';
import useAuthStore from '@/store/auth.store';
import { useAuth } from '@clerk/clerk-expo';

interface MyBookingsProps {
  onBookingPress?: (booking: Booking) => void;
}

const MyBookings: React.FC<MyBookingsProps> = ({ onBookingPress }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salonDetails, setSalonDetails] = useState<Record<string, SalonDetails>>({});
  const { user } = useAuthStore();
  const { getToken } = useAuth();

  // Fallback salon names for known salon IDs
  const knownSalons: Record<string, string> = {
    '02040abe-68ac-4864-999f-316a02b3dfcc': "Jimmy's",
    '6229ad22-fa4b-46c6-8025-b522512007ec': "Kane's",
    '5b43a882-1459-4897-bfe7-67449bf200a7': "Pius's",
    '6d6f5e38-f178-4242-bb97-70796c6449ef': "Kane's",
  };

  useEffect(() => {
    if (user?.$id) {
      console.log('User ID changed, fetching bookings for:', user.$id);
      fetchBookings();
    }
  }, [user?.$id]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userId = user?.$id;
      const userEmail = user?.email;
      console.log('Current user ID:', userId);
      console.log('User email for matching:', userEmail);
      
      const token = await getToken();
      const data = await getBookings(token ?? undefined, userId, userEmail);
      console.log('Raw bookings data received:', JSON.stringify(data, null, 2));
      console.log('Number of bookings:', data.length);
      
      // Log each booking's status and payment status
      data.forEach((booking, index) => {
        console.log(`Booking ${index + 1}:`, {
          id: booking.id,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          totalAmount: booking.totalAmount,
          bookingTime: booking.bookingTime
        });
      });
      
      setBookings(data);
      
      // Fetch salon details for each unique salon ID
      const uniqueSalonIds = [...new Set(data.map(booking => booking.saloonId))];
      const salonDetailsMap: Record<string, SalonDetails> = {};
      
      for (const salonId of uniqueSalonIds) {
        try {
          const salon = await getSalon(salonId);
          if (salon) {
            salonDetailsMap[salonId] = salon;
          }
        } catch (err) {
          console.log(`Failed to fetch salon ${salonId}:`, err);
        }
      }
      
      setSalonDetails(salonDetailsMap);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#10B981'; // Green
      case 'pending':
        return '#F59E0B'; // Amber
      case 'completed':
        return '#6B7280'; // Gray
      case 'cancelled':
        return '#EF4444'; // Red
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'completed':
        return 'checkmark-done-circle';
      case 'cancelled':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <View style={{ 
        backgroundColor: '#FFFFFF', 
        borderRadius: 16, 
        padding: 24, 
        marginHorizontal: 24,
        marginBottom: 24,
        shadowColor: '#423120',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E0D7CA',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200
      }}>
        <ActivityIndicator size="large" color="#423120" />
        <Text style={{ 
          fontSize: 16, 
          color: '#423120', 
          marginTop: 12,
          opacity: 0.7 
        }}>
          Loading your bookings...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ 
        backgroundColor: '#FFFFFF', 
        borderRadius: 16, 
        padding: 24, 
        marginHorizontal: 24,
        marginBottom: 24,
        shadowColor: '#423120',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E0D7CA',
        alignItems: 'center'
      }}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={{ 
          fontSize: 18, 
          fontWeight: '600', 
          color: '#423120', 
          marginTop: 12,
          textAlign: 'center'
        }}>
          Unable to load bookings
        </Text>
        <Text style={{ 
          fontSize: 14, 
          color: '#423120', 
          marginTop: 8,
          opacity: 0.7,
          textAlign: 'center'
        }}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={fetchBookings}
          style={{
            backgroundColor: '#423120',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 8,
            marginTop: 16
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
            Try Again
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  console.log('Rendering MyBookings - bookings array length:', bookings.length);
  console.log('Bookings array:', bookings);
  
  if (bookings.length === 0) {
    console.log('Showing empty state - no bookings found');
    return (
      <View style={{ 
        backgroundColor: '#FFFFFF', 
        borderRadius: 16, 
        padding: 24, 
        marginHorizontal: 24,
        marginBottom: 24,
        shadowColor: '#423120',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E0D7CA',
        alignItems: 'center'
      }}>
        <Ionicons name="calendar-outline" size={48} color="#D7C3A7" />
        <Text style={{ 
          fontSize: 18, 
          fontWeight: '600', 
          color: '#423120', 
          marginTop: 12,
          textAlign: 'center'
        }}>
          No bookings yet
        </Text>
        <Text style={{ 
          fontSize: 14, 
          color: '#423120', 
          marginTop: 8,
          opacity: 0.7,
          textAlign: 'center'
        }}>
          Start your beauty journey by booking a service
        </Text>
      </View>
    );
  }

  return (
    <View style={{ 
      backgroundColor: '#FFFFFF', 
      borderRadius: 16, 
      padding: 24, 
      marginHorizontal: 24,
      marginBottom: 24,
      shadowColor: '#423120',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      borderWidth: 1,
      borderColor: '#E0D7CA'
    }}>
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 20 
      }}>
        <Text style={{ 
          fontSize: 20, 
          fontWeight: '600', 
          color: '#423120' 
        }}>
          My Bookings
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => {
            console.log('Manual refresh triggered');
            fetchBookings();
          }}>
            <Ionicons name="refresh" size={20} color="#423120" />
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => {
            console.log('DEBUG: Fetching ALL bookings (no user filter)');
            try {
              const debugToken = await getToken();
              const allData = await getBookings(debugToken ?? undefined); // No user ID
              console.log('DEBUG: All bookings (no filter):', JSON.stringify(allData, null, 2));
              Alert.alert('Debug Info', `Found ${allData.length} total bookings in system`);
            } catch (err) {
              console.error('Debug fetch error:', err);
            }
          }}>
            <Ionicons name="bug" size={20} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </View>

      {bookings.map((booking, index) => (
        <TouchableOpacity
          key={booking.id}
          onPress={() => onBookingPress?.(booking)}
          style={{
            backgroundColor: '#F8F9FA',
            borderRadius: 12,
            padding: 16,
            marginBottom: index < bookings.length - 1 ? 12 : 0,
            borderWidth: 1,
            borderColor: '#E0D7CA'
          }}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '600', 
                color: '#423120',
                marginBottom: 4
              }}>
                {booking.service?.name || 'Service'}
              </Text>
              <Text style={{ 
                fontSize: 14, 
                color: '#423120', 
                opacity: 0.7,
                marginBottom: 2
              }}>
                {salonDetails[booking.saloonId]?.name || 
                 booking.saloon?.name || 
                 knownSalons[booking.saloonId] || 
                 `Salon ID: ${booking.saloonId}` || 
                 'Salon'}
              </Text>
              <Text style={{ 
                fontSize: 12, 
                color: '#423120', 
                opacity: 0.6
              }}>
                {formatDate(booking.bookingTime)}
              </Text>
            </View>
            
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: getStatusColor(booking.status),
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                marginBottom: 8
              }}>
                <Ionicons 
                  name={getStatusIcon(booking.status) as any} 
                  size={12} 
                  color="#FFFFFF" 
                />
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontSize: 10, 
                  fontWeight: '600',
                  marginLeft: 4,
                  textTransform: 'capitalize'
                }}>
                  {booking.status}
                </Text>
              </View>
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '600', 
                color: '#423120'
              }}>
                {formatCurrency(booking.totalAmount)}
              </Text>
            </View>
          </View>
          
          {booking.notes && (
            <View style={{ 
              marginTop: 12, 
              paddingTop: 12, 
              borderTopWidth: 1, 
              borderTopColor: '#E0D7CA' 
            }}>
              <Text style={{ 
                fontSize: 12, 
                color: '#423120', 
                opacity: 0.7,
                fontStyle: 'italic'
              }}>
                "{booking.notes}"
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default MyBookings;
