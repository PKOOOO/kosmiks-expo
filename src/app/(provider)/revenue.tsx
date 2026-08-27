import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
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
  service: { name: string } | null;
  user: { name: string; email: string } | null;
};

type RevenueData = {
  saloon: { id: string; name: string };
  totalRevenue: number;
  bookingsCount: number;
  bookings: Booking[];
};

type MonthGroup = {
  key: string;
  label: string;
  revenue: number;
  count: number;
};

const fmt = (amount: number) =>
  `€${amount.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const groupByMonth = (bookings: Booking[]): MonthGroup[] => {
  const acc: Record<string, { revenue: number; count: number }> = {};
  for (const b of bookings) {
    const key = b.bookingTime.slice(0, 7); // "2025-04"
    if (!acc[key]) acc[key] = { revenue: 0, count: 0 };
    if (b.status !== 'cancelled') {
      acc[key].revenue += b.totalAmount ?? 0;
      acc[key].count++;
    }
  }
  return Object.entries(acc)
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
    .map(([key, { revenue, count }]) => {
      const [year, month] = key.split('-');
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en', {
        month: 'long',
        year: 'numeric',
      });
      return { key, label, revenue, count };
    });
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
        <View style={{ width: 140, height: 14, borderRadius: 6, backgroundColor: beige, opacity: 0.5 }} />
        <View style={{ width: 60, height: 14, borderRadius: 6, backgroundColor: beige, opacity: 0.5 }} />
      </View>
      <View style={{ width: 100, height: 12, borderRadius: 6, backgroundColor: beige, opacity: 0.35 }} />
    </View>
  );
}

export default function ProviderRevenueScreen() {
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const fetchRevenue = useCallback(async () => {
    try {
      setError(null);
      const token = await getTokenRef.current();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token ?? ''}`,
      };
      if (token) headers['X-User-Token'] = token;

      const res = await fetch(`${API_BASE_URL}/provider/revenue`, { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
    } catch {
      setError('Failed to load revenue data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRevenue();
    }, [fetchRevenue])
  );

  const months = data ? groupByMonth(data.bookings) : [];

  const renderBooking = ({ item, index }: { item: Booking; index: number }) => {
    const dt = new Date(item.bookingTime);
    const dateStr = dt.toLocaleDateString('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = dt.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

    return (
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 13,
          borderBottomWidth: index < (data?.bookings.length ?? 0) - 1 ? 1 : 0,
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
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: darkBrown }}>
              {fmt(item.totalAmount ?? 0)}
            </Text>
            <StatusBadge status={item.status} />
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: beige }}>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, color: darkBrown }}>Revenue</Text>
        </View>
        {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
      <FlatList
        data={data?.bookings ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderBooking}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRevenue(); }}
            tintColor={darkBrown}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        ListHeaderComponent={
          <>
            {/* Page header */}
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: beige,
              }}
            >
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, color: darkBrown }}>
                Revenue
              </Text>
              {data?.saloon.name && (
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#888', marginTop: 2 }}>
                  {data.saloon.name}
                </Text>
              )}
            </View>

            {error && (
              <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
                <Text style={{ color: red, fontFamily: 'Philosopher-Regular', fontSize: 13 }}>{error}</Text>
              </View>
            )}

            {/* Summary card */}
            {data && (
              <View
                style={{
                  marginHorizontal: 20,
                  marginTop: 16,
                  backgroundColor: darkBrown,
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 20,
                }}
              >
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: beige, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Total Revenue
                </Text>
                <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 32, color: white, marginTop: 4 }}>
                  {fmt(data.totalRevenue)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={beige} />
                  <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: beige }}>
                    {data.bookingsCount} confirmed {data.bookingsCount === 1 ? 'booking' : 'bookings'}
                  </Text>
                </View>
              </View>
            )}

            {/* Monthly breakdown */}
            {months.length > 0 && (
              <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                <Text
                  style={{
                    fontFamily: 'Philosopher-Bold',
                    fontSize: 12,
                    color: '#888',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: 10,
                  }}
                >
                  Monthly Breakdown
                </Text>
                <View style={{ borderWidth: 2, borderColor: beige, borderRadius: 12, overflow: 'hidden' }}>
                  {months.map((m, i) => (
                    <View
                      key={m.key}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: i < months.length - 1 ? 1 : 0,
                        borderBottomColor: beige,
                        backgroundColor: i === 0 ? lightBeige : white,
                      }}
                    >
                      <View>
                        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: darkBrown }}>
                          {m.label}
                        </Text>
                        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#888', marginTop: 1 }}>
                          {m.count} {m.count === 1 ? 'booking' : 'bookings'}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: darkBrown }}>
                        {fmt(m.revenue)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Recent bookings label */}
            {(data?.bookings.length ?? 0) > 0 && (
              <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
                <Text
                  style={{
                    fontFamily: 'Philosopher-Bold',
                    fontSize: 12,
                    color: '#888',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  All Bookings
                </Text>
              </View>
            )}

            {(data?.bookings.length ?? 0) > 0 && (
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
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 40 }}>
              <Ionicons name="trending-up-outline" size={48} color={beige} style={{ marginBottom: 12 }} />
              <Text style={{ fontFamily: 'Philosopher-Regular', color: '#888', fontSize: 15, textAlign: 'center' }}>
                No bookings yet.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
