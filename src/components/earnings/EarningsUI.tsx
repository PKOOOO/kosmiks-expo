import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { PayoutStatus } from '@/lib/earnings';

export const colors = {
  dark: '#423120',
  beige: '#D7C3A7',
  light: '#F4EDE5',
  sand: '#EDE3D8',
  white: '#FFFFFF',
  muted: '#8A7F75',
  line: '#EFE4D6',
  green: '#2d7a2d',
  greenBg: '#E8F3E6',
  amber: '#A0702C',
  amberBg: '#F7EEDF',
  red: '#B44747',
  redBg: '#FCECE9',
};

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: '#E8D9C8' }, style]}>
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{
      fontFamily: 'Philosopher-Bold', fontSize: 13, color: colors.muted,
      letterSpacing: 0.4, marginTop: 26, marginBottom: 10, marginLeft: 4,
    }}>
      {children}
    </Text>
  );
}

/** A tappable row inside a Card: icon · title/subtitle · trailing value · chevron. */
export function ListRow({
  icon, title, subtitle, trailing, onPress, last,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  trailing?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line,
      }}
    >
      {icon && (
        <View style={{
          width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.light,
        }}>
          <Ionicons name={icon} size={19} color={colors.dark} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>{trailing}</Text>
      ) : null}
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.beige} />}
    </TouchableOpacity>
  );
}

/** Label on the left, amount on the right — used in breakdowns. */
export function AmountRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
      <Text style={{ fontFamily: strong ? 'Philosopher-Bold' : 'Philosopher-Regular', fontSize: 15, color: strong ? colors.dark : '#6F6258' }}>
        {label}
      </Text>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: strong ? 17 : 15, color: colors.dark }}>
        {value}
      </Text>
    </View>
  );
}

const STATUS_STYLE: Record<PayoutStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: colors.amber, bg: colors.amberBg },
  sent: { label: 'Sent', color: colors.dark, bg: colors.light },
  arrived: { label: 'Arrived', color: colors.green, bg: colors.greenBg },
  failed: { label: 'Failed', color: colors.red, bg: colors.redBg },
};

export function StatusChip({ status }: { status: PayoutStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <View style={{ paddingHorizontal: 10, minHeight: 24, justifyContent: 'center', borderRadius: 12, backgroundColor: s.bg }}>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: s.color }}>{s.label}</Text>
    </View>
  );
}

/** Title bar for pages pushed on top of the Earnings overview. */
export function SubpageHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }}>
      <TouchableOpacity
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.light, borderWidth: 1, borderColor: 'rgba(66,49,32,0.12)',
        }}
      >
        <Ionicons name="arrow-back" size={21} color={colors.dark} />
      </TouchableOpacity>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, color: colors.dark }}>{title}</Text>
    </View>
  );
}
