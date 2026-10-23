import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Platform,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  useEarningsStore, summarise, nextPayoutDate, totalsByMonth, formatEur, formatDay, formatDate,
  maskIban, type EarningsBooking,
} from '@/lib/earnings';
import { Card, SectionLabel, ListRow, StatusChip, colors } from '@/components/earnings/EarningsUI';
import BrandHeader from '@/components/BrandHeader';
import { useTabBarSpace } from '@/lib/layout';

type Segment = 'payouts' | 'revenue';

// Earnings tab: "Payouts" (what you'll be paid and when) and "Revenue"
// (booking history by month) — formerly two separate tabs.
export default function EarningsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const { data, loading, error, load } = useEarningsStore();
  const [segment, setSegment] = useState<Segment>('payouts');
  const [refreshing, setRefreshing] = useState(false);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useFocusEffect(useCallback(() => { void load(() => getTokenRef.current()); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load(() => getTokenRef.current());
    setRefreshing(false);
  };

  if (loading && !data) {
    return (
      <SafeAreaView
        edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined}
        style={{ flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color={colors.dark} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined}
      style={{ flex: 1, backgroundColor: colors.sand }}
    >
      <BrandHeader />
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <SegmentedControl value={segment} onChange={setSegment} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: tabBarSpace,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.dark} />}
      >
        {error && !data ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : data ? (
          segment === 'payouts'
            ? <PayoutsSection router={router} />
            : <RevenueSection />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Payouts ─────────────────────────────────────────────────────────────────

function PayoutsSection({ router }: { router: ReturnType<typeof useRouter> }) {
  const data = useEarningsStore(s => s.data)!;
  const summary = summarise(data);
  const next = nextPayoutDate();
  const isToday = next.toDateString() === new Date().toDateString();
  const feePct = Math.round(data.feeRate * 100);
  const recent = [...data.payouts]
    .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))
    .slice(0, 6);

  return (
    <>
      {/* Hero: the one number that matters */}
      <View style={{ backgroundColor: colors.dark, borderRadius: 22, padding: 22 }}>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.beige }}>
          Available for payout
        </Text>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 42, color: colors.white, marginTop: 4 }}>
          {formatEur(summary.available)}
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18,
          paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(215,195,167,0.25)',
        }}>
          <Ionicons name="calendar-outline" size={16} color={colors.beige} />
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: colors.white, flex: 1 }}>
            Next payout {isToday ? 'today' : formatDay(next)}
          </Text>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.beige }}>
            after {feePct}% fee
          </Text>
        </View>
      </View>

      {summary.upcomingCount > 0 && (
        <Card style={{ marginTop: 12 }}>
          <ListRow
            icon="time-outline"
            title="Upcoming"
            subtitle={`${summary.upcomingCount} ${summary.upcomingCount === 1 ? 'booking' : 'bookings'} not yet completed`}
            trailing={formatEur(summary.upcomingNet)}
            last
          />
        </Card>
      )}

      <SectionLabel>Recent payouts</SectionLabel>
      {recent.length === 0 ? (
        <Card style={{ paddingVertical: 26, paddingHorizontal: 24, alignItems: 'center' }}>
          <View style={{
            width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.light, marginBottom: 12,
          }}>
            <Ionicons name="wallet-outline" size={22} color={colors.dark} />
          </View>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: colors.dark }}>No payouts yet</Text>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 4, lineHeight: 20 }}>
            Your payouts will show up here once they're sent.
          </Text>
        </Card>
      ) : (
        <Card>
          {recent.map((p, i) => (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/(provider)/payouts/${p.id}` as any)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15,
                borderBottomWidth: i < recent.length - 1 ? 1 : 0, borderBottomColor: colors.line,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>
                  {formatDate(new Date(p.scheduledFor))}
                </Text>
                <View style={{ flexDirection: 'row', marginTop: 6 }}>
                  <StatusChip status={p.status} />
                </View>
              </View>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: colors.dark }}>{formatEur(p.amount)}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.beige} />
            </TouchableOpacity>
          ))}
        </Card>
      )}

      <SectionLabel>Settings</SectionLabel>
      <Card>
        <ListRow
          icon="business-outline"
          title="Bank account"
          subtitle={data.iban ? maskIban(data.iban) : 'Not added'}
          onPress={() => router.push('/(provider)/payouts/bank' as any)}
        />
        <ListRow
          icon="help-circle-outline"
          title="How payouts work"
          onPress={() => router.push('/(provider)/payouts/how-it-works' as any)}
          last
        />
      </Card>
    </>
  );
}

// ─── Revenue ─────────────────────────────────────────────────────────────────

function RevenueSection() {
  const data = useEarningsStore(s => s.data)!;
  const months = totalsByMonth(data.bookings);
  const total = months.reduce((s, m) => s + m.revenue, 0);
  const count = months.reduce((s, m) => s + m.count, 0);
  const recent = data.bookings.slice(0, 30);

  if (data.bookings.length === 0) {
    return (
      <Card style={{ paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' }}>
        <Ionicons name="trending-up-outline" size={30} color={colors.beige} />
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: colors.dark, marginTop: 10 }}>No bookings yet</Text>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted, marginTop: 4 }}>
          Revenue from your bookings will appear here.
        </Text>
      </Card>
    );
  }

  return (
    <>
      <Card style={{ padding: 20 }}>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted }}>Total revenue</Text>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 34, color: colors.dark, marginTop: 2 }}>{formatEur(total)}</Text>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 4 }}>
          {count} {count === 1 ? 'booking' : 'bookings'} · before platform fee
        </Text>
      </Card>

      <SectionLabel>By month</SectionLabel>
      <Card>
        {months.map((m, i) => (
          <ListRow
            key={m.key}
            title={m.label}
            subtitle={`${m.count} ${m.count === 1 ? 'booking' : 'bookings'}`}
            trailing={formatEur(m.revenue)}
            last={i === months.length - 1}
          />
        ))}
      </Card>

      <SectionLabel>Recent bookings</SectionLabel>
      <Card>
        {recent.map((b, i) => <BookingRow key={b.id} booking={b} last={i === recent.length - 1} />)}
      </Card>
    </>
  );
}

function BookingRow({ booking, last }: { booking: EarningsBooking; last: boolean }) {
  const when = new Date(booking.bookingTime);
  const cancelled = booking.status === 'cancelled';
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line,
    }}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>
          {booking.service?.name ?? 'Service'}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 2 }}>
          {booking.customerName || booking.user?.name || 'Customer'} · {formatDay(when)}
        </Text>
      </View>
      <Text style={{
        fontFamily: 'Philosopher-Bold', fontSize: 15,
        color: cancelled ? colors.muted : colors.dark,
        textDecorationLine: cancelled ? 'line-through' : 'none',
      }}>
        {formatEur(booking.totalAmount ?? 0)}
      </Text>
    </View>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function SegmentedControl({ value, onChange }: { value: Segment; onChange: (v: Segment) => void }) {
  const options: { key: Segment; label: string }[] = [
    { key: 'payouts', label: 'Payouts' },
    { key: 'revenue', label: 'Revenue' },
  ];
  return (
    <View style={{ flexDirection: 'row', marginTop: 14, padding: 4, borderRadius: 22, backgroundColor: '#E2D3BF' }}>
      {options.map(o => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            activeOpacity={0.8}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
              backgroundColor: active ? colors.white : 'transparent',
              shadowColor: '#000', shadowOpacity: active ? 0.08 : 0, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
              elevation: active ? 1 : 0,
            }}
          >
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: active ? colors.dark : colors.muted }}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card style={{ padding: 24, alignItems: 'center' }}>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: colors.dark }}>{message}</Text>
      <TouchableOpacity onPress={onRetry} style={{ marginTop: 12 }}>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: colors.dark, textDecorationLine: 'underline' }}>
          Try again
        </Text>
      </TouchableOpacity>
    </Card>
  );
}
