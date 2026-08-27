import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { API_BASE_URL } from '../../../config/constants';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const white = '#FFFFFF';
const green = '#2d7a2d';
const yellow = '#b07d00';
const red = '#c00';

type Booking = {
  id: string;
  totalAmount: number | null;
  status: string;
  bookingTime: string;
  customerName: string | null;
  customerPhone: string | null;
  service: { name: string } | null;
  user: { name: string; email: string } | null;
};

function StatusBadge({ status }: { status: string }) {
  const config =
    status === 'confirmed'
      ? { color: green, bg: '#f0fff0', label: 'Confirmed' }
      : status === 'pending'
      ? { color: yellow, bg: '#fffbf0', label: 'Pending' }
      : { color: red, bg: '#fff0f0', label: 'Cancelled' };

  return (
    <View style={{ backgroundColor: config.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 11, color: config.color }}>
        {config.label}
      </Text>
    </View>
  );
}

function SkeletonRow() {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: beige }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <View style={{ width: 150, height: 14, borderRadius: 6, backgroundColor: beige, opacity: 0.5 }} />
        <View style={{ width: 70, height: 14, borderRadius: 6, backgroundColor: beige, opacity: 0.5 }} />
      </View>
      <View style={{ width: 110, height: 12, borderRadius: 6, backgroundColor: beige, opacity: 0.35 }} />
    </View>
  );
}

export default function ProviderBookingsScreen() {
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const buildHeaders = async (): Promise<Record<string, string>> => {
    const token = await getTokenRef.current();
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    };
    if (token) h['X-User-Token'] = token;
    return h;
  };

  const fetchBookings = useCallback(async () => {
    try {
      setError(null);
      const headers = await buildHeaders();
      const res = await fetch(`${API_BASE_URL}/provider/bookings`, { headers });
      if (!res.ok) {
        const body = await res.text();
        console.log('[ProviderBookings] fetch error', res.status, body);
        throw new Error(`${res.status}`);
      }
      const data = await res.json();
      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch {
      setError('Failed to load bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );

  const updateStatus = async (bookingId: string, status: 'confirmed' | 'cancelled') => {
    setActionLoading(bookingId);
    try {
      const headers = await buildHeaders();
      const res = await fetch(`${API_BASE_URL}/provider/bookings/${bookingId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
      );
    } catch {
      Alert.alert('Error', 'Failed to update booking status.');
    } finally {
      setActionLoading(null);
    }
  };

  const confirmBooking = (id: string) =>
    Alert.alert('Confirm booking?', 'Mark this booking as confirmed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => updateStatus(id, 'confirmed') },
    ]);

  const cancelBooking = (id: string) =>
    Alert.alert('Cancel booking?', 'This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: () => updateStatus(id, 'cancelled') },
    ]);

  const now = new Date();
  const upcomingStatuses = ['pending', 'confirmed'];

  const filtered =
    filter === 'all'
      ? bookings
      : filter === 'upcoming'
      ? bookings.filter((b) => upcomingStatuses.includes(b.status) && new Date(b.bookingTime) >= now)
      : bookings.filter((b) => !upcomingStatuses.includes(b.status) || new Date(b.bookingTime) < now);

  const renderBooking = ({ item, index }: { item: Booking; index: number }) => {
    const dt = new Date(item.bookingTime);
    const dateStr = dt.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' });
    const timeStr = dt.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
    const isPast = dt < now || item.status === 'cancelled';
    const isActioning = actionLoading === item.id;

    return (
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 13,
          borderBottomWidth: index < filtered.length - 1 ? 1 : 0,
          borderBottomColor: beige,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: darkBrown }}>
              {item.customerName || item.user?.name || 'Unknown'}
            </Text>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#666', marginTop: 2 }}>
              {item.service?.name ?? '—'}
            </Text>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 11, color: '#aaa', marginTop: 2 }}>
              {dateStr} · {timeStr}
            </Text>
            {item.status !== 'cancelled' && item.customerPhone ? (
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 11, color: '#888', marginTop: 2 }}>
                {item.customerPhone}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            {item.totalAmount != null && (
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: darkBrown }}>
                €{item.totalAmount.toFixed(2)}
              </Text>
            )}
            <StatusBadge status={item.status} />
          </View>
        </View>

        {!isPast && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {item.status === 'pending' && (
              <TouchableOpacity
                onPress={() => confirmBooking(item.id)}
                disabled={isActioning}
                style={{
                  flex: 1,
                  backgroundColor: darkBrown,
                  borderRadius: 8,
                  paddingVertical: 8,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {isActioning ? (
                  <ActivityIndicator size="small" color={white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-outline" size={14} color={white} />
                    <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: white }}>Confirm</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => cancelBooking(item.id)}
              disabled={isActioning}
              style={{
                flex: 1,
                backgroundColor: white,
                borderWidth: 1.5,
                borderColor: red,
                borderRadius: 8,
                paddingVertical: 8,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {isActioning ? (
                <ActivityIndicator size="small" color={red} />
              ) : (
                <>
                  <Ionicons name="close-outline" size={14} color={red} />
                  <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: red }}>Cancel</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: beige, gap: 12 }}>
          <TouchableOpacity onPress={() => router.replace('/(app)/(tabs)/' as any)} style={{ padding: 2 }}>
            <Ionicons name="arrow-back" size={22} color={darkBrown} />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, color: darkBrown }}>Bookings</Text>
        </View>
        {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderBooking}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchBookings(); }}
            tintColor={darkBrown}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        ListHeaderComponent={
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: beige, gap: 12 }}>
              <TouchableOpacity onPress={() => router.replace('/(app)/(tabs)/' as any)} style={{ padding: 2 }}>
                <Ionicons name="arrow-back" size={22} color={darkBrown} />
              </TouchableOpacity>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, color: darkBrown }}>Bookings</Text>
            </View>

            {error && (
              <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
                <Text style={{ color: red, fontFamily: 'Philosopher-Regular', fontSize: 13 }}>{error}</Text>
                <TouchableOpacity onPress={fetchBookings} style={{ marginTop: 8 }}>
                  <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: darkBrown }}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 }}>
              {(['upcoming', 'past', 'all'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: filter === f ? darkBrown : lightBeige,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Philosopher-Bold',
                      fontSize: 13,
                      color: filter === f ? white : darkBrown,
                      textTransform: 'capitalize',
                    }}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filtered.length > 0 && (
              <View
                style={{
                  borderWidth: 2,
                  borderColor: beige,
                  borderRadius: 12,
                  marginHorizontal: 20,
                  overflow: 'hidden',
                }}
              />
            )}
          </>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={{ alignItems: 'center', paddingHorizontal: 40, paddingTop: 40 }}>
              <Ionicons name="calendar-outline" size={48} color={beige} style={{ marginBottom: 12 }} />
              <Text style={{ fontFamily: 'Philosopher-Regular', color: '#888', fontSize: 15, textAlign: 'center' }}>
                No {filter === 'all' ? '' : filter + ' '}bookings yet.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
