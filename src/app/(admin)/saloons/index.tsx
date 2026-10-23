import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { adminRequest } from '@/lib/admin-api';
import { reverseGeocode } from '@/lib/geocode';
import { Card, EmptyState, SearchBar, shortArea, colors } from '@/components/admin/AdminUI';
import BrandHeader from '@/components/BrandHeader';
import { useTabBarSpace } from '@/lib/layout';

type Saloon = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  shortIntro: string | null;
  createdAt: string;
  images?: { url: string }[];
  user: { name: string | null; email: string };
  _count: { images: number; bookings: number; reviews: number };
};

export default function AdminSaloonsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [saloons, setSaloons] = useState<Saloon[]>([]);
  const [areas, setAreas] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminRequest<Saloon[]>(() => getTokenRef.current(), '/admin/saloons');
      setSaloons(Array.isArray(data) ? data : []);
    } catch {
      setError("Couldn't load salons.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // Salons saved with only coordinates get a readable area looked up once.
  useEffect(() => {
    const missing = saloons.filter(s => !shortArea(s.address) && s.latitude != null && s.longitude != null && !areas[s.id]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const s of missing) {
        const name = await reverseGeocode(s.latitude!, s.longitude!);
        if (cancelled) return;
        const area = shortArea(name);
        if (area) setAreas(prev => ({ ...prev, [s.id]: area }));
      }
    })();
    return () => { cancelled = true; };
  }, [saloons]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return saloons;
    return saloons.filter(s =>
      s.name.toLowerCase().includes(q)
      || (s.user.name ?? '').toLowerCase().includes(q)
      || s.user.email.toLowerCase().includes(q)
      || (s.address ?? '').toLowerCase().includes(q));
  }, [saloons, query]);

  return (
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.sand }}>
      <BrandHeader />
      <SearchBar value={query} onChange={setQuery} placeholder="Search salon, owner or area" />

      {loading ? (
        <ActivityIndicator size="large" color={colors.dark} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => s.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: tabBarSpace }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.dark} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={<EmptyState icon="storefront-outline" title={error ?? 'No salons found'} />}
          renderItem={({ item }) => {
            const area = shortArea(item.address) ?? areas[item.id] ?? (item.latitude != null ? 'Location pinned' : 'No address');
            const cover = item.images?.[0]?.url;
            return (
              <TouchableOpacity activeOpacity={0.85} onPress={() => router.push(`/(admin)/saloons/${item.id}` as any)}>
                <Card style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  {cover ? (
                    <Image source={{ uri: cover }} style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: colors.sand }} />
                  ) : (
                    <View style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="storefront-outline" size={26} color={colors.muted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: colors.dark }}>{item.name}</Text>
                    <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 1 }}>
                      {item.user.name || item.user.email}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <Ionicons name="location-outline" size={13} color={colors.muted} />
                      <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted }}>{area}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>{item._count.bookings}</Text>
                    <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 11, color: colors.muted }}>bookings</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
