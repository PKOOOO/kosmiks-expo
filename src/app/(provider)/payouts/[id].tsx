import React from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useEarningsStore, formatEur, formatDate, formatDay, maskIban, type Payout } from '@/lib/earnings';
import { Card, SectionLabel, AmountRow, StatusChip, SubpageHeader, colors } from '@/components/earnings/EarningsUI';
import { usePageBottomSpace } from '@/lib/layout';

const STEPS: { key: 'scheduled' | 'sent' | 'arrived'; label: string; dateOf: (p: Payout) => string | null | undefined }[] = [
  { key: 'scheduled', label: 'Scheduled', dateOf: p => p.scheduledFor },
  { key: 'sent', label: 'Sent to your bank', dateOf: p => p.sentAt },
  { key: 'arrived', label: 'Arrived', dateOf: p => p.arrivedAt },
];
const ORDER = { scheduled: 0, sent: 1, arrived: 2, failed: -1 } as const;

export default function PayoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useEarningsStore(s => s.data);
  const pageBottom = usePageBottomSpace();
  const payout = data?.payouts.find(p => p.id === id);

  return (
    <SafeAreaView
      edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined}
      style={{ flex: 1, backgroundColor: colors.sand }}
    >
      <SubpageHeader title="Payout" />
      {!payout ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.muted }}>
            This payout couldn't be found.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: pageBottom }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', paddingVertical: 18 }}>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 40, color: colors.dark }}>{formatEur(payout.amount)}</Text>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 10 }}>
              {formatDate(new Date(payout.scheduledFor))}
              {(payout.iban || data?.iban) ? ` · to ${maskIban(payout.iban || data!.iban!)}` : ''}
            </Text>
            <StatusChip status={payout.status} />
          </View>

          {payout.status === 'failed' ? (
            <Card style={{ padding: 18, marginTop: 8, flexDirection: 'row', gap: 12 }}>
              <Ionicons name="alert-circle-outline" size={22} color={colors.red} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>This transfer didn't go through</Text>
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 3 }}>
                  {payout.failureReason ? `${payout.failureReason}. ` : ''}The amount goes back to your balance and is included in the next payout.
                </Text>
              </View>
            </Card>
          ) : (
          <>
          <SectionLabel>Progress</SectionLabel>
          <Card style={{ padding: 18 }}>
            {STEPS.map((step, i) => {
              const done = ORDER[payout.status] >= ORDER[step.key];
              const date = step.dateOf(payout);
              const last = i === STEPS.length - 1;
              return (
                <View key={step.key} style={{ flexDirection: 'row' }}>
                  <View style={{ alignItems: 'center', width: 26 }}>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: done ? colors.dark : colors.sand,
                      borderWidth: done ? 0 : 2, borderColor: colors.beige,
                    }}>
                      {done && <Ionicons name="checkmark" size={13} color={colors.white} />}
                    </View>
                    {!last && <View style={{ width: 2, flex: 1, minHeight: 22, marginVertical: 3, backgroundColor: done ? colors.dark : colors.beige }} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12, paddingBottom: last ? 0 : 18 }}>
                    <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: done ? colors.dark : colors.muted }}>
                      {step.label}
                    </Text>
                    {date && done ? (
                      <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 2 }}>
                        {formatDay(new Date(date))}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
          </>
          )}

          <SectionLabel>Breakdown</SectionLabel>
          <Card style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
            <AmountRow label="Bookings total" value={formatEur(payout.gross)} />
            <AmountRow label="Platform fee" value={`− ${formatEur(payout.fee)}`} />
            <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 6 }} />
            <AmountRow label="You receive" value={formatEur(payout.amount)} strong />
          </Card>

          <IncludedBookings payout={payout} />

          {payout.reference ? (
            <>
              <SectionLabel>Bank reference</SectionLabel>
              <Card style={{ padding: 16 }}>
                <Text selectable style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>{payout.reference}</Text>
              </Card>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function IncludedBookings({ payout }: { payout: Payout }) {
  const bookings = useEarningsStore(s => s.data?.bookings ?? []);
  const ids = new Set(payout.bookingIds ?? []);
  const included = bookings.filter(b => ids.has(b.id));
  if (included.length === 0) return null;
  return (
    <>
      <SectionLabel>{`Bookings included (${included.length})`}</SectionLabel>
      <Card>
        {included.map((b, i) => (
          <View
            key={b.id}
            style={{
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13,
              borderBottomWidth: i < included.length - 1 ? 1 : 0, borderBottomColor: colors.line,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>
                {b.service?.name ?? 'Service'}
              </Text>
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 2 }}>
                {formatDay(new Date(b.bookingTime))}
              </Text>
            </View>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>{formatEur(b.totalAmount ?? 0)}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}
