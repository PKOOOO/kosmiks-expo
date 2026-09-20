import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ActivityIndicator, SafeAreaView,
  ScrollView, RefreshControl,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/config/constants';

const ADMIN_API_KEY = process.env.EXPO_PUBLIC_ADMIN_API_KEY || '';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const pageBg = '#EDE3D8';
const white = '#FFFFFF';
const green = '#2d7a2d';
const greenBg = '#edfaed';
const greenBorder = '#a8d5a8';

type PayoutData = {
  pendingBalance: number;
  totalRevenue: number;
  platformFee: number;
  platformFeeRate: number;
  bookingsCount: number;
  iban: string | null;
  bankAccountName: string | null;
};

const formatEur = (n: number) =>
  new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n);

const formatIbanForDisplay = (iban: string) =>
  iban.replace(/(.{4})/g, '$1 ').trim();

export default function ProviderPayoutsScreen() {
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const fetchPayout = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      const headers: Record<string, string> = { Authorization: `Bearer ${ADMIN_API_KEY}` };
      if (token) headers['X-User-Token'] = token;
      const res = await fetch(`${API_BASE_URL}/provider/revenue`, { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData({
        pendingBalance: json.pendingBalance ?? 0,
        totalRevenue: json.totalRevenue ?? 0,
        platformFee: json.platformFee ?? 0,
        platformFeeRate: json.platformFeeRate ?? 0.10,
        bookingsCount: json.bookingsCount ?? 0,
        iban: json.payout?.iban ?? null,
        bankAccountName: json.payout?.bankAccountName ?? null,
      });
    } catch (err) {
      console.log('[Payouts] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPayout(); }, [fetchPayout]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: pageBg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={darkBrown} />
      </SafeAreaView>
    );
  }

  const feeRate = Math.round((data?.platformFeeRate ?? 0.10) * 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pageBg }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: pageBg }}>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, color: darkBrown }}>
          Payouts
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: insets.bottom + 80,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchPayout(); }}
            tintColor={darkBrown}
          />
        }
      >

        {/* ── Pending balance ──────────────────────────────────────────────── */}
        <View style={{
          borderWidth: 1.5, borderColor: greenBorder, borderRadius: 16,
          padding: 20, backgroundColor: greenBg,
        }}>
          <Text style={{
            fontFamily: 'Philosopher-Bold', fontSize: 11, color: green,
            letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10,
          }}>
            Pending Balance
          </Text>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 38, color: darkBrown, marginBottom: 6 }}>
            {formatEur(data?.pendingBalance ?? 0)}
          </Text>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#555' }}>
            From {data?.bookingsCount ?? 0} bookings · after {feeRate}% platform fee
          </Text>
        </View>

        {/* ── Payout schedule ──────────────────────────────────────────────── */}
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Ionicons name="calendar-outline" size={18} color={darkBrown} />
            <Text style={cardTitle}>Payout schedule</Text>
          </View>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: '#555', lineHeight: 21 }}>
            Payouts are processed manually every Friday via SEPA bank transfer.
          </Text>
        </View>

        {/* ── Bank account ─────────────────────────────────────────────────── */}
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Ionicons name="business-outline" size={18} color={darkBrown} />
            <Text style={cardTitle}>Bank account</Text>
          </View>

          {/* Stacked rows so long IBAN never overflows */}
          <BankRow label="Holder" value={data?.bankAccountName ?? '—'} />
          <BankRow label="IBAN" value={data?.iban ? formatIbanForDisplay(data.iban) : '—'} mono />

          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#aaa', marginTop: 12 }}>
            To update your bank details, contact support.
          </Text>
        </View>

        {/* ── Breakdown ────────────────────────────────────────────────────── */}
        <View style={card}>
          <Text style={[cardTitle, { marginBottom: 14 }]}>Breakdown</Text>

          <BreakdownRow label="Total revenue" value={formatEur(data?.totalRevenue ?? 0)} />
          <BreakdownRow label="Platform fee" value={`− ${formatEur(data?.platformFee ?? 0)}`} />

          <View style={{ height: 1, backgroundColor: beige, marginVertical: 12 }} />

          <BreakdownRow
            label="Your payout"
            value={formatEur(data?.pendingBalance ?? 0)}
            bold
          />
        </View>

        {/* ── Info bullets ─────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 4, paddingTop: 4, gap: 14 }}>
          {[
            { icon: "shield-checkmark-outline", text: "Servey processes manual SEPA transfers to your IBAN." },
            { icon: "time-outline", text: "Funds typically arrive within 1-2 business days after Friday’s transfer." },
            { icon: "help-circle-outline", text: "Questions about a payout? Contact support@servey.fi." },
          ].map(({ icon, text }) => (
            <View key={icon} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
              <Ionicons name={icon as any} size={15} color={beige} style={{ marginTop: 2 }} />
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#888', flex: 1, lineHeight: 19 }}>
                {text}
              </Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BankRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#aaa', marginBottom: 2 }}>
        {label}
      </Text>
      <Text style={{
        fontFamily: mono ? 'Philosopher-Regular' : 'Philosopher-Bold',
        fontSize: 15,
        color: darkBrown,
        fontVariant: mono ? ['tabular-nums'] : undefined,
      }}>
        {value}
      </Text>
    </View>
  );
}

function BreakdownRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <Text style={{ fontFamily: bold ? 'Philosopher-Bold' : 'Philosopher-Regular', fontSize: 14, color: '#666' }}>
        {label}
      </Text>
      <Text style={{ fontFamily: bold ? 'Philosopher-Bold' : 'Philosopher-Regular', fontSize: bold ? 16 : 14, color: darkBrown }}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const card = {
  backgroundColor: white,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#E8D9C8',
  padding: 20,
};

const cardTitle = {
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 16,
  color: darkBrown,
};
