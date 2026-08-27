import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { API_BASE_URL } from '../../../config/constants';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const white = '#FFFFFF';

type Stats = {
  globalCategories: number;
  parentServices: number;
  totalSaloons: number;
  totalEnrolledServices: number;
  totalRevenue: number;
};

type SaloonRevenue = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  totalRevenue: number;
  bookingsCount: number;
};

type RevenueData = {
  grandTotal: number;
  saloons: SaloonRevenue[];
};

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: lightBeige,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: beige,
        minWidth: '45%',
      }}
    >
      <Ionicons name={icon as any} size={22} color={darkBrown} style={{ marginBottom: 6 }} />
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 20, color: darkBrown }}>{value}</Text>
      <Text
        style={{
          fontFamily: 'Philosopher-Regular',
          fontSize: 11,
          color: '#888',
          textAlign: 'center',
          marginTop: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function AdminOverviewScreen() {
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
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

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const headers = await authHeaders();
      const [statsRes, revenueRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/stats`, { headers }),
        fetch(`${API_BASE_URL}/admin/revenue`, { headers }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (revenueRes.ok) setRevenue(await revenueRes.json());
      if (!statsRes.ok && !revenueRes.ok) throw new Error('Failed to load');
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: white, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={darkBrown} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
      {/* Header: back arrow + title */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: beige,
        }}
      >
        <TouchableOpacity
          onPress={() => router.replace('/(app)/(tabs)' as any)}
          style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={darkBrown} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            fontFamily: 'Philosopher-Bold',
            fontSize: 18,
            color: darkBrown,
            textAlign: 'center',
            marginRight: 40, // mirror the back button width so title stays visually centred
          }}
        >
          Overview
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            tintColor={darkBrown}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <Text style={{ color: '#c00', fontFamily: 'Philosopher-Regular', fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* ── Stat cards ── */}
        {stats && (
          <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
            <SectionLabel>Platform Stats</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
              <StatCard
                icon="storefront-outline"
                label="Saloons"
                value={stats.totalSaloons}
              />
              <StatCard
                icon="cash-outline"
                label="Total Revenue"
                value={`€${Number(stats.totalRevenue).toFixed(2)}`}
              />
              <StatCard
                icon="grid-outline"
                label="Categories"
                value={stats.globalCategories}
              />
              <StatCard
                icon="cut-outline"
                label="Services"
                value={stats.parentServices}
              />
              <StatCard
                icon="checkmark-circle-outline"
                label="Enrolled Services"
                value={stats.totalEnrolledServices}
              />
            </View>
          </View>
        )}

        {/* ── Revenue by saloon ── */}
        {revenue && (
          <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel>Revenue by Saloon</SectionLabel>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: darkBrown }}>
                Grand total: €{Number(revenue.grandTotal).toFixed(2)}
              </Text>
            </View>

            {revenue.saloons.length === 0 ? (
              <EmptyState icon="cash-outline" message="No revenue data yet." />
            ) : (
              <View style={{ borderWidth: 2, borderColor: beige, borderRadius: 12, overflow: 'hidden', marginTop: 10 }}>
                {revenue.saloons.map((s, i) => (
                  <View
                    key={s.id}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderBottomWidth: i < revenue.saloons.length - 1 ? 1 : 0,
                      borderBottomColor: beige,
                      backgroundColor: i === 0 ? lightBeige : white,
                    }}
                  >
                    {/* Rank badge */}
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: i === 0 ? darkBrown : beige,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Philosopher-Bold',
                          fontSize: 11,
                          color: i === 0 ? white : darkBrown,
                        }}
                      >
                        {i + 1}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: darkBrown }}>
                        {s.name}
                      </Text>
                      <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#888', marginTop: 1 }}>
                        {s.ownerName} · {s.bookingsCount} bookings
                      </Text>
                    </View>

                    <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: darkBrown }}>
                      €{Number(s.totalRevenue).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: 'Philosopher-Bold',
        fontSize: 12,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}
    >
      {children}
    </Text>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View
      style={{
        marginTop: 12,
        padding: 24,
        borderWidth: 2,
        borderColor: beige,
        borderRadius: 12,
        alignItems: 'center',
      }}
    >
      <Ionicons name={icon as any} size={28} color={beige} style={{ marginBottom: 8 }} />
      <Text style={{ fontFamily: 'Philosopher-Regular', color: '#888', fontSize: 14 }}>{message}</Text>
    </View>
  );
}
