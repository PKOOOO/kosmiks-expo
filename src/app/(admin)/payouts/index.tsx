import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAdminStore, type AdminPayout } from '@/lib/admin-api';
import { formatEur, formatDate, maskIban } from '@/lib/earnings';
import { FilterPills, Card, EmptyState, colors } from '@/components/admin/AdminUI';
import { StatusChip } from '@/components/earnings/EarningsUI';
import BrandHeader from '@/components/BrandHeader';
import { useTabBarSpace } from '@/lib/layout';

// Providers withdraw their own earnings through Stripe Connect; this screen
// is a read-only record. "Manual" holds the old SEPA payouts (an admin still
// moves those along on the detail page).
type Filter = 'stripe' | 'failed' | 'manual';

const inFilter = (p: AdminPayout, f: Filter) =>
  f === 'failed' ? p.status === 'failed'
    : f === 'stripe' ? p.status === 'processing' || p.status === 'transferred'
    : p.status === 'scheduled' || p.status === 'sent' || p.status === 'arrived';

export default function AdminPayoutsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const payouts = useAdminStore(s => s.payouts);
  const loaded = useAdminStore(s => s.payoutsLoaded);
  const loadPayouts = useAdminStore(s => s.loadPayouts);
  const [filter, setFilter] = useState<Filter>('stripe');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await loadPayouts(() => getTokenRef.current());
    } catch (e: any) {
      setError(e?.message === 'Forbidden' ? 'Only signed-in admins can see payouts.' : "Couldn't load payouts.");
    } finally {
      setRefreshing(false);
    }
  }, [loadPayouts]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const counts = useMemo(() => ({
    stripe: payouts.filter(p => inFilter(p, 'stripe')).length,
    failed: payouts.filter(p => inFilter(p, 'failed')).length,
    manual: payouts.filter(p => inFilter(p, 'manual')).length,
  }), [payouts]);
  const list = payouts.filter(p => inFilter(p, filter));

  // Paid to providers' Stripe accounts this calendar month.
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const thisMonth = payouts.filter(p => p.status === 'transferred' && (p.sentAt ?? p.scheduledFor) >= monthStart);
  const thisMonthTotal = thisMonth.reduce((s, p) => s + p.amount, 0);

  const header = (
    <View style={{ marginBottom: 14 }}>
      <View style={{ backgroundColor: colors.dark, borderRadius: 22, padding: 20 }}>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.beige }}>Sent to providers this month</Text>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 36, color: colors.white, marginTop: 2 }}>{formatEur(thisMonthTotal)}</Text>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.beige, marginTop: 2 }}>
          Providers withdraw their earnings themselves through Stripe.
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.sand }}>
      <BrandHeader />
      <FilterPills
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'stripe', label: 'Stripe', count: counts.stripe },
          { key: 'failed', label: 'Failed', count: counts.failed },
          { key: 'manual', label: 'Manual', count: counts.manual },
        ]}
      />

      {!loaded ? (
        <ActivityIndicator size="large" color={colors.dark} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={p => p.id}
          ListHeaderComponent={filter === 'stripe' ? header : undefined}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: tabBarSpace }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.dark} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="cash-outline"
              title={error ?? (filter === 'stripe' ? 'No withdrawals yet' : filter === 'failed' ? 'No failed payouts' : 'No manual payouts')}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.85} onPress={() => router.push(`/(admin)/payouts/${item.id}` as any)}>
              <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: colors.dark }}>
                    {item.bankAccountName || item.user.name || item.user.email}
                  </Text>
                  <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 2 }}>
                    {item.iban ? maskIban(item.iban) : 'Stripe'} · {formatDate(new Date(item.scheduledFor))}
                  </Text>
                  <View style={{ flexDirection: 'row', marginTop: 8 }}>
                    <StatusChip status={item.status} />
                  </View>
                </View>
                <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 17, color: colors.dark }}>{formatEur(item.amount)}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.beige} />
              </Card>
            </TouchableOpacity>
          )}
        />
      )}

    </SafeAreaView>
  );
}
