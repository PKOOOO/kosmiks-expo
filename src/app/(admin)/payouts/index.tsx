import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { adminRequest, useAdminStore, type AdminPayout } from '@/lib/admin-api';
import { formatEur, formatDate, maskIban } from '@/lib/earnings';
import { FilterPills, Card, EmptyState, Button, BottomSheet, colors } from '@/components/admin/AdminUI';
import { StatusChip } from '@/components/earnings/EarningsUI';
import BrandHeader from '@/components/BrandHeader';
import { useTabBarSpace } from '@/lib/layout';

type Filter = 'scheduled' | 'sent' | 'history';

const inFilter = (p: AdminPayout, f: Filter) =>
  f === 'history' ? p.status === 'arrived' || p.status === 'failed' : p.status === f;

export default function AdminPayoutsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const payouts = useAdminStore(s => s.payouts);
  const loaded = useAdminStore(s => s.payoutsLoaded);
  const loadPayouts = useAdminStore(s => s.loadPayouts);
  const [filter, setFilter] = useState<Filter>('scheduled');
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
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
    scheduled: payouts.filter(p => inFilter(p, 'scheduled')).length,
    sent: payouts.filter(p => inFilter(p, 'sent')).length,
    history: payouts.filter(p => inFilter(p, 'history')).length,
  }), [payouts]);
  const toSend = payouts.filter(p => p.status === 'scheduled');
  const toSendTotal = toSend.reduce((s, p) => s + p.amount, 0);
  const list = payouts.filter(p => inFilter(p, filter));

  // "Run payouts now" sheet: confirm first, then show what happened.
  const [runSheet, setRunSheet] = useState(false);
  const [runResult, setRunResult] = useState<{ created: number; skipped: number } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const openRunSheet = () => {
    setRunResult(null);
    setRunError(null);
    setRunSheet(true);
  };

  const runNow = async () => {
    setRunning(true);
    setRunError(null);
    try {
      const result = await adminRequest<{ created: unknown[]; skipped: unknown[] }>(
        () => getTokenRef.current(), '/admin/payouts', { method: 'POST' },
      );
      await load();
      setFilter('scheduled');
      setRunResult({ created: result.created.length, skipped: result.skipped.length });
    } catch (e: any) {
      setRunError(e?.message ?? "Couldn't run payouts. Please try again.");
    } finally {
      setRunning(false);
    }
  };

  const header = (
    <View style={{ marginBottom: 14 }}>
      <View style={{ backgroundColor: colors.dark, borderRadius: 22, padding: 20 }}>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.beige }}>To send</Text>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 36, color: colors.white, marginTop: 2 }}>{formatEur(toSendTotal)}</Text>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.beige, marginTop: 2 }}>
          {toSend.length === 0 ? 'Nothing waiting' : `${toSend.length} ${toSend.length === 1 ? 'provider' : 'providers'}`}
        </Text>
      </View>
      <Button
        label="Run payouts now"
        icon="refresh"
        variant="outline"
        onPress={openRunSheet}
        style={{ marginTop: 12 }}
      />
    </View>
  );

  return (
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.sand }}>
      <BrandHeader />
      <FilterPills
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'scheduled', label: 'To send', count: counts.scheduled },
          { key: 'sent', label: 'Sent', count: counts.sent },
          { key: 'history', label: 'History', count: counts.history },
        ]}
      />

      {!loaded ? (
        <ActivityIndicator size="large" color={colors.dark} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={p => p.id}
          ListHeaderComponent={filter === 'scheduled' ? header : undefined}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: tabBarSpace }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.dark} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="cash-outline"
              title={error ?? (filter === 'scheduled' ? 'No payouts to send' : filter === 'sent' ? 'Nothing in transit' : 'No past payouts yet')}
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
                    {maskIban(item.iban)} · {formatDate(new Date(item.scheduledFor))}
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

      <BottomSheet
        visible={runSheet}
        onClose={() => !running && setRunSheet(false)}
        title={runResult ? (runResult.created > 0 ? 'Payouts created' : 'Nothing to pay out') : 'Run payouts now?'}
        footer={
          runResult ? (
            <Button label="Done" onPress={() => setRunSheet(false)} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setRunSheet(false)} disabled={running} />
              <Button label="Run payouts" style={{ flex: 1.3 }} onPress={runNow} loading={running} />
            </View>
          )
        }
      >
        {runResult ? (
          <View style={{ gap: 10, marginBottom: 6 }}>
            <ResultLine icon="checkmark-circle" tone={colors.green} text={`${runResult.created} new ${runResult.created === 1 ? 'payout' : 'payouts'} scheduled`} />
            {runResult.skipped > 0 && (
              <ResultLine icon="alert-circle" tone={colors.amber} text={`${runResult.skipped} ${runResult.skipped === 1 ? 'provider' : 'providers'} skipped — usually no IBAN on file`} />
            )}
          </View>
        ) : (
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.muted, lineHeight: 21, marginBottom: 6 }}>
            Creates a payout for every provider with an available balance — the same thing that happens automatically each Friday. Bookings already in a payout are never paid twice.
          </Text>
        )}
        {runError ? (
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.red, marginTop: 8 }}>{runError}</Text>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

function ResultLine({ icon, tone, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; tone: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name={icon} size={20} color={tone} />
      <Text style={{ flex: 1, fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.dark }}>{text}</Text>
    </View>
  );
}
