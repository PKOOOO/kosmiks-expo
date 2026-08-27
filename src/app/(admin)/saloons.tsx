import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../../config/constants';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const white = '#FFFFFF';

type Saloon = {
  id: string;
  name: string;
  address: string | null;
  createdAt: string;
  user: { name: string; email: string };
  _count: { images: number; bookings: number; reviews: number };
};

export default function AdminSaloonsScreen() {
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [saloons, setSaloons] = useState<Saloon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    };
    if (token) h['X-User-Token'] = token;
    return h;
  }, [getToken]);

  const fetchSaloons = useCallback(async () => {
    try {
      setError(null);
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE_URL}/admin/saloons`, { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setSaloons(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load saloons.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchSaloons(); }, [fetchSaloons]);

  const renderItem = ({ item, index }: { item: Saloon; index: number }) => {
    const joined = new Date(item.createdAt).toLocaleDateString('fi-FI', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: index < saloons.length - 1 ? 1 : 0,
          borderBottomColor: beige,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: darkBrown }}>
              {item.name}
            </Text>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#666', marginTop: 2 }}>
              {item.user.name}
            </Text>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#aaa', marginTop: 1 }}>
              {item.user.email}
            </Text>
            {item.address && (
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#888', marginTop: 2 }}>
                {item.address}
              </Text>
            )}
          </View>

          {/* Counts column */}
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <CountBadge icon="calendar-outline" value={item._count.bookings} label="bookings" />
            <CountBadge icon="star-outline" value={item._count.reviews} label="reviews" />
            <CountBadge icon="images-outline" value={item._count.images} label="photos" />
          </View>
        </View>

        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 11, color: '#bbb', marginTop: 6 }}>
          Joined {joined}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: white, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={darkBrown} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: beige,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, color: darkBrown }}>
          Saloons
        </Text>
        <View
          style={{
            backgroundColor: lightBeige,
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 16,
          }}
        >
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: darkBrown }}>
            {saloons.length} total
          </Text>
        </View>
      </View>

      {error && (
        <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
          <Text style={{ color: '#c00', fontFamily: 'Philosopher-Regular', fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {saloons.length === 0 && !error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="business-outline" size={48} color={beige} style={{ marginBottom: 12 }} />
          <Text style={{ fontFamily: 'Philosopher-Regular', color: '#888', fontSize: 15, textAlign: 'center' }}>
            No saloons registered yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={saloons}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchSaloons(); }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          ListHeaderComponent={
            <View
              style={{
                borderWidth: 2,
                borderColor: beige,
                borderRadius: 12,
                marginHorizontal: 20,
                marginTop: 16,
                overflow: 'hidden',
              }}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function CountBadge({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon as any} size={12} color="#aaa" />
      <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#888' }}>
        {value} {label}
      </Text>
    </View>
  );
}
