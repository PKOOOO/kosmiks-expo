import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEarningsStore, SUPPORT_EMAIL } from '@/lib/earnings';
import { colors } from '@/components/earnings/EarningsUI';

// Bottom sheet: everything that used to be small print on the payouts page.
export default function HowPayoutsWorkSheet() {
  const feePct = Math.round((useEarningsStore(s => s.data?.feeRate) ?? 0.1) * 100);

  const points: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
    {
      icon: 'pricetag-outline',
      title: `${feePct}% platform fee`,
      body: `Taken from each completed booking. You keep ${100 - feePct}%.`,
    },
    {
      icon: 'calendar-outline',
      title: 'Paid every Friday',
      body: 'Your available balance is sent to your bank account by SEPA transfer.',
    },
    {
      icon: 'time-outline',
      title: 'Arrives in 1–2 business days',
      body: 'Depending on your bank.',
    },
  ];

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 }}>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 24, color: colors.dark, marginBottom: 20 }}>
        How payouts work
      </Text>
      {points.map(p => (
        <View key={p.title} style={{ flexDirection: 'row', gap: 14, marginBottom: 20 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.sand,
          }}>
            <Ionicons name={p.icon} size={19} color={colors.dark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: colors.dark }}>{p.title}</Text>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 2 }}>
              {p.body}
            </Text>
          </View>
        </View>
      ))}

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => undefined)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}
      >
        <Ionicons name="mail-outline" size={17} color={colors.dark} />
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted }}>
          Questions? <Text style={{ fontFamily: 'Philosopher-Bold', color: colors.dark }}>{SUPPORT_EMAIL}</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
