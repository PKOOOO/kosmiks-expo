import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { adminRequest } from '@/lib/admin-api';
import { SubpageHeader, Card, Avatar, Chip, EmptyState, SearchBar, colors, relativeDay } from '@/components/admin/AdminUI';
import { usePageBottomSpace } from '@/lib/layout';

type User = {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  _count: { saloons: number; bookings: number; reviews: number };
};

export default function AdminUsersScreen() {
  const { getToken } = useAuth();
  const pageBottom = usePageBottomSpace();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminRequest<User[]>(() => getTokenRef.current(), '/admin/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setError("Couldn't load users.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => (u.name ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);

  return (
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.sand }}>
      <SubpageHeader title={`Users${users.length ? ` · ${users.length}` : ''}`} />
      <SearchBar value={query} onChange={setQuery} placeholder="Search name or email" />

      {loading ? (
        <ActivityIndicator size="large" color={colors.dark} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={u => u.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: pageBottom, paddingTop: 4 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.dark} />}
          ListEmptyComponent={<EmptyState icon="people-outline" title={error ?? 'No users found'} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <Avatar name={item.name || item.email} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>
                    {item.name || 'No name'}
                  </Text>
                  {item.isAdmin && <Chip label="Admin" tone="amber" />}
                </View>
                <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 1 }}>
                  {item.email}
                </Text>
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: colors.muted, marginTop: 3 }}>
                  {item._count.bookings} bookings · {item._count.saloons > 0 ? 'Provider · ' : ''}joined {relativeDay(item.createdAt).toLowerCase()}
                </Text>
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

