import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEarningsStore, formatIban, maskIban, SUPPORT_EMAIL } from '@/lib/earnings';
import { Card, SubpageHeader, colors } from '@/components/earnings/EarningsUI';

export default function BankAccountScreen() {
  const data = useEarningsStore(s => s.data);
  const [revealed, setRevealed] = useState(false);
  const iban = data?.iban ?? null;

  // There's no in-app change flow yet (it needs a backend request + admin
  // review), so changes go to support by email for now.
  const requestChange = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Change payout bank account')}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Change bank account', `Email ${SUPPORT_EMAIL} and we'll help you update it.`);
    }
  };

  return (
    <SafeAreaView
      edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined}
      style={{ flex: 1, backgroundColor: colors.sand }}
    >
      <SubpageHeader title="Bank account" />
      <View style={{ paddingHorizontal: 16 }}>
        <Card style={{ padding: 20 }}>
          <View style={{
            width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.light, marginBottom: 16,
          }}>
            <Ionicons name="business-outline" size={22} color={colors.dark} />
          </View>

          <Text style={label}>Account holder</Text>
          <Text style={value}>{data?.bankAccountName || '—'}</Text>

          <Text style={[label, { marginTop: 18 }]}>IBAN</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text selectable={revealed} style={[value, { flex: 1, letterSpacing: 0.5 }]}>
              {iban ? (revealed ? formatIban(iban) : maskIban(iban)) : '—'}
            </Text>
            {iban && (
              <TouchableOpacity
                onPress={() => setRevealed(r => !r)}
                accessibilityRole="button"
                accessibilityLabel={revealed ? 'Hide IBAN' : 'Show IBAN'}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, paddingHorizontal: 4 }}>
          <Ionicons name="shield-checkmark-outline" size={17} color={colors.muted} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontFamily: 'Philosopher-Regular', fontSize: 14, lineHeight: 20, color: colors.muted }}>
            Payouts are sent only to this account. For your security, changes are checked by our team before they're used.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={requestChange}
          style={{
            marginTop: 24, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: colors.dark,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>Change bank account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const label = { fontFamily: 'Philosopher-Regular' as const, fontSize: 13, color: colors.muted, marginBottom: 3 };
const value = { fontFamily: 'Philosopher-Bold' as const, fontSize: 17, color: colors.dark };
