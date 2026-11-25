import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEarningsStore, SUPPORT_EMAIL } from '@/lib/earnings';
import { colors } from '@/components/earnings/EarningsUI';
import { useT } from '@/i18n';

// Bottom sheet: everything that used to be small print on the payouts page.
export default function HowPayoutsWorkSheet() {
  const { t } = useT();
  const feePct = Math.round((useEarningsStore(s => s.data?.feeRate) ?? 0.1) * 100);

  const points: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
    {
      icon: 'pricetag-outline',
      title: t('payout.feeTitle', { pct: feePct }),
      body: t('payout.feeBody', { keep: 100 - feePct }),
    },
    {
      icon: 'card-outline',
      title: t('payout.stripeTitle'),
      body: t('payout.stripeBody'),
    },
    {
      icon: 'arrow-up-circle-outline',
      title: t('payout.withdrawTitle'),
      body: t('payout.withdrawBody'),
    },
    {
      icon: 'time-outline',
      title: t('payout.bankTitle'),
      body: t('payout.bankBody'),
    },
  ];

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 }}>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 24, color: colors.dark, marginBottom: 20 }}>
        {t('payout.howTitle')}
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
