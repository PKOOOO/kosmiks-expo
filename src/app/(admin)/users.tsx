import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
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

type User = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  _count: { saloons: number; bookings: number; reviews: number };
};

export default function AdminUsersScreen() {
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState<User[]>([]);
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

  const fetchUsers = useCallback(async () => {
    try {
      setError(null);
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE_URL}/admin/users`, { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const renderItem = ({ item, index }: { item: User; index: number }) => {
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
          borderBottomWidth: index < users.length - 1 ? 1 : 0,
          borderBottomColor: beige,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: darkBrown }}>
                {item.name}
              </Text>
              {item.isAdmin && (
                <View
                  style={{
                    backgroundColor: darkBrown,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 10, color: white }}>
                    ADMIN
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#888', marginTop: 2 }}>
              {item.email}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {item._count.saloons > 0 && (
              <CountBadge icon="business-outline" value={item._count.saloons} label="saloons" />
            )}
            <CountBadge icon="calendar-outline" value={item._count.bookings} label="bookings" />
            <CountBadge icon="star-outline" value={item._count.reviews} label="reviews" />
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
          Users
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
            {users.length} total
          </Text>
        </View>
      </View>

      {error && (
        <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
          <Text style={{ color: '#c00', fontFamily: 'Philosopher-Regular', fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {users.length === 0 && !error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="people-outline" size={48} color={beige} style={{ marginBottom: 12 }} />
          <Text style={{ fontFamily: 'Philosopher-Regular', color: '#888', fontSize: 15, textAlign: 'center' }}>
            No users registered yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchUsers(); }}
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
