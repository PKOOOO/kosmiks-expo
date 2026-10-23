import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { adminRequest, useAdminStore, isAwaitingReview } from '@/lib/admin-api';
import { formatEur } from '@/lib/earnings';
import { Card, SectionLabel, ListRow, colors } from '@/components/admin/AdminUI';
import BrandHeader from '@/components/BrandHeader';
import { useTabBarSpace } from '@/lib/layout';

type RevenueBooking = { totalAmount: number | null; status: string; bookingTime: string };
type SaloonRevenue = {
  id: string;
  name: string;
  ownerName: string;
  totalRevenue: number;
  bookingsCount: number;
  bookings: RevenueBooking[];
};

const FEE_RATE = 0.1;
const isPaid = (b: RevenueBooking) => b.status !== 'pending' && b.status !== 'cancelled';

function monthTotals(saloons: SaloonRevenue[], offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
  let revenue = 0;
  let count = 0;
  for (const s of saloons) {
    for (const b of s.bookings) {
      const t = new Date(b.bookingTime);
      if (isPaid(b) && t >= start && t < end) {
        revenue += b.totalAmount ?? 0;
        count++;
      }
    }
  }
  return { revenue, count, fee: Math.round(revenue * FEE_RATE * 100) / 100 };
}

export default function AdminHomeScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const applications = useAdminStore(s => s.applications);
  const payouts = useAdminStore(s => s.payouts);
  const loadApplications = useAdminStore(s => s.loadApplications);
  const loadPayouts = useAdminStore(s => s.loadPayouts);

  const [saloons, setSaloons] = useState<SaloonRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tokenFn = () => getTokenRef.current();
    setError(null);
    try {
      const [r] = await Promise.all([
        adminRequest<{ saloons: SaloonRevenue[] }>(tokenFn, '/admin/revenue'),
        loadApplications(tokenFn).catch(() => undefined),
        loadPayouts(tokenFn).catch(() => undefined),
      ]);
      setSaloons(Array.isArray(r?.saloons) ? r.saloons : []);
    } catch {
      setError("Couldn't load the dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadApplications, loadPayouts]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const toReview = applications.filter(a => isAwaitingReview(a.user.providerStatus)).length;
  const scheduled = payouts.filter(p => p.status === 'scheduled');
  const toSendAmount = scheduled.reduce((s, p) => s + p.amount, 0);
  const thisMonth = monthTotals(saloons, 0);
  const lastMonth = monthTotals(saloons, 1);
  const monthName = new Date().toLocaleDateString('en-GB', { month: 'long' });
  const lastMonthName = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('en-GB', { month: 'long' });

  return (
    <SafeAreaView
      edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined}
      style={{ flex: 1, backgroundColor: colors.sand }}
    >
      <BrandHeader />

      {loading ? (
        <ActivityIndicator size="large" color={colors.dark} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBarSpace }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.dark} />}
        >
          {error && (
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.red, marginBottom: 10, marginLeft: 4 }}>{error}</Text>
          )}

          {/* Needs attention */}
          {toReview === 0 && scheduled.length === 0 ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
              <Ionicons name="checkmark-circle" size={22} color={colors.green} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: colors.dark }}>All caught up</Text>
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 1 }}>
                  No applications or payouts waiting.
                </Text>
              </View>
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {toReview > 0 && (
                <AttentionCard
                  icon="document-text"
                  title={`${toReview} ${toReview === 1 ? 'application' : 'applications'} to review`}
                  onPress={() => router.navigate('/(admin)/applications' as any)}
                />
              )}
              {scheduled.length > 0 && (
                <AttentionCard
                  icon="cash"
                  title={`${scheduled.length} ${scheduled.length === 1 ? 'payout' : 'payouts'} to send`}
                  subtitle={formatEur(toSendAmount)}
                  onPress={() => router.navigate('/(admin)/payouts' as any)}
                />
              )}
            </View>
          )}

          {/* This month */}
          <SectionLabel>{`${monthName} so far`}</SectionLabel>
          <Card style={{ padding: 22 }}>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.muted }}>Bookings revenue</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ fontFamily: 'Philosopher-Bold', fontSize: 46, lineHeight: 54, color: colors.dark, marginTop: 4 }}
            >
              {formatEur(thisMonth.revenue)}
            </Text>
            <Comparison now={thisMonth.revenue} before={lastMonth.revenue} beforeLabel={lastMonthName} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Metric icon="trending-up-outline" label="Platform fee" value={formatEur(thisMonth.fee)} />
              <Metric icon="calendar-outline" label="Paid bookings" value={String(thisMonth.count)} />
            </View>
          </Card>

          <Card style={{ marginTop: 14 }}>
            <ListRow icon="people-outline" title="All users" subtitle="Customers, providers and admins" onPress={() => router.push('/(admin)/home/users' as any)} last />
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function AttentionCard({
  icon, title, subtitle, onPress,
}: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle?: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.dark }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(215,195,167,0.22)',
      }}>
        <Ionicons name={icon} size={19} color={colors.beige} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: colors.white }}>{title}</Text>
        {subtitle ? <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.beige, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.beige} />
    </TouchableOpacity>
  );
}

/**
 * Change vs last month. A percentage only means something when both months
 * have revenue — otherwise just show last month's figure.
 */
function Comparison({ now, before, beforeLabel }: { now: number; before: number; beforeLabel: string }) {
  if (now > 0 && before > 0) {
    const pct = Math.round(((now - before) / before) * 100);
    const up = pct >= 0;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, height: 24,
          borderRadius: 12, backgroundColor: up ? colors.greenBg : colors.redBg,
        }}>
          <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={12} color={up ? colors.green : colors.red} />
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: up ? colors.green : colors.red }}>{Math.abs(pct)}%</Text>
        </View>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted }}>vs {beforeLabel}</Text>
      </View>
    );
  }
  return (
    <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 4 }}>
      {before > 0 ? `${beforeLabel}: ${formatEur(before)}` : now > 0 ? 'First revenue this month' : 'No paid bookings yet this month'}
    </Text>
  );
}

function Metric({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: colors.light }}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, color: colors.dark, marginTop: 8 }}>{value}</Text>
      <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 1 }}>{label}</Text>
    </View>
  );
}
