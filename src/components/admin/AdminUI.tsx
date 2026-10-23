import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, ScrollView, ViewStyle, TextInput,
  Modal, KeyboardAvoidingView, Keyboard, Platform, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/components/earnings/EarningsUI';

export { colors, Card, SectionLabel, ListRow, AmountRow, SubpageHeader } from '@/components/earnings/EarningsUI';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Large left-aligned page title with an optional accessory on the right. */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 28, color: colors.dark }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted, marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Round icon button used in headers (add, profile…). */
export function RoundButton({
  icon, onPress, label, filled,
}: { icon: IconName; onPress: () => void; label: string; filled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.8}
      style={{
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        backgroundColor: filled ? colors.dark : colors.light,
        borderWidth: filled ? 0 : 1, borderColor: 'rgba(66,49,32,0.12)',
      }}
    >
      <Ionicons name={icon} size={22} color={filled ? colors.white : colors.dark} />
    </TouchableOpacity>
  );
}

/** Horizontal filter pills with counts. */
export function FilterPills<K extends string>({
  options, value, onChange,
}: { options: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 6 }}
      style={{ flexGrow: 0 }}
    >
      {options.map(o => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 16, borderRadius: 19,
              backgroundColor: active ? colors.dark : colors.white,
              borderWidth: 1, borderColor: active ? colors.dark : '#E8D9C8',
            }}
          >
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: active ? colors.white : colors.dark }}>{o.label}</Text>
            {o.count !== undefined && (
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: active ? colors.beige : colors.muted }}>{o.count}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/** Two-option switch (Categories | Services…). */
export function Segmented<K extends string>({
  options, value, onChange, style,
}: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; style?: ViewStyle }) {
  return (
    <View style={[{ flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: '#E2D3BF' }, style]}>
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
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: active ? colors.dark : colors.muted }}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Initials in a circle. */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.sand,
    }}>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: size * 0.36, color: colors.dark }}>{initials}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 }}>
      <View style={{
        width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.white, marginBottom: 12,
      }}>
        <Ionicons name={icon} size={24} color={colors.dark} />
      </View>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 17, color: colors.dark, textAlign: 'center' }}>{title}</Text>
      {body ? (
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 4, lineHeight: 20 }}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

export function Button({
  label, onPress, variant = 'primary', loading, disabled, style, icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: IconName;
}) {
  const bg = variant === 'primary' ? colors.dark : 'transparent';
  const fg = variant === 'primary' ? colors.white : variant === 'danger' ? colors.red : colors.dark;
  const border = variant === 'primary' ? colors.dark : variant === 'danger' ? colors.red : colors.dark;
  // Disabled fade lives on a wrapper: TouchableOpacity keeps the opacity it
  // mounted with, so a button that starts disabled would stay faded.
  return (
    <View style={[{ opacity: disabled ? 0.45 : 1 }, style]}>
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading) }}
      style={{
        height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: border, backgroundColor: bg,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingHorizontal: 18,
      }}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: fg }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
    </View>
  );
}

/** Label / value line inside a detail card. */
export function InfoRow({ label, value, last, right }: { label: string; value?: string | null; last?: boolean; right?: React.ReactNode }) {
  if (!value && !right) return null;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line,
    }}>
      <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted, width: 110 }}>{label}</Text>
      <Text selectable style={{ flex: 1, fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>{value}</Text>
      {right}
    </View>
  );
}

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'amber' | 'green' | 'red' }) {
  const map = {
    neutral: { fg: colors.dark, bg: colors.light },
    amber: { fg: colors.amber, bg: colors.amberBg },
    green: { fg: colors.green, bg: colors.greenBg },
    red: { fg: colors.red, bg: colors.redBg },
  }[tone];
  return (
    <View style={{ paddingHorizontal: 10, minHeight: 24, justifyContent: 'center', borderRadius: 12, backgroundColor: map.bg }}>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: map.fg }}>{label}</Text>
    </View>
  );
}

export const relativeDay = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 10,
      height: 46, paddingHorizontal: 16, borderRadius: 23, backgroundColor: colors.white,
      borderWidth: 1, borderColor: '#E8D9C8',
    }}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ flex: 1, fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.dark, paddingVertical: 0 }}
      />
      {value ? <Ionicons name="close-circle" size={18} color={colors.muted} onPress={() => onChange('')} /> : null}
    </View>
  );
}

/** 1-2-3 progress: done = brown, waiting for review = amber, still to do = beige. */
export function PhaseDots({ phase, waiting, rejected }: { phase: number; waiting: boolean; rejected?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3].map(p => {
        const done = p < phase || (p === phase && !waiting && !rejected);
        const current = p === phase && (waiting || rejected);
        return (
          <View
            key={p}
            style={{
              width: 18, height: 5, borderRadius: 3,
              backgroundColor: current ? (rejected ? colors.red : colors.amber) : done ? colors.dark : colors.beige,
            }}
          />
        );
      })}
    </View>
  );
}

const COORDS = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/;

/** Last two parts of an address ("Kamppi, Helsinki"), never raw coordinates. */
export const shortArea = (address: string | null | undefined) => {
  if (!address || COORDS.test(address)) return null;
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  return parts.length > 2 ? parts.slice(-2).join(', ') : address;
};

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return visible;
}

/**
 * Bottom sheet for forms and confirmations. Sits directly on the keyboard
 * (no home-indicator gap while typing), never grows under the status bar, and
 * scrolls its content when it doesn't fit.
 */
export function BottomSheet({
  visible, onClose, title, children, footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Pinned under the scrolling content (e.g. the save button). */
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const keyboardVisible = useKeyboardVisible();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => { Keyboard.dismiss(); onClose(); }}
          accessibilityLabel="Close"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(30,20,12,0.45)' }}
        />
        <View style={{
          maxHeight: height - insets.top - 16,
          backgroundColor: colors.light,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingTop: 10,
          paddingBottom: keyboardVisible ? 12 : insets.bottom + 16,
          shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 },
          elevation: 16,
        }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.beige, alignSelf: 'center', marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, marginBottom: 14 }}>
            <Text style={{ flex: 1, fontFamily: 'Philosopher-Bold', fontSize: 21, color: colors.dark }}>{title}</Text>
            <TouchableOpacity
              onPress={() => { Keyboard.dismiss(); onClose(); }}
              accessibilityLabel="Close"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand }}
            >
              <Ionicons name="close" size={19} color={colors.dark} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 22 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Labelled form field for sheets. */
export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: colors.muted, marginBottom: 6, marginLeft: 2 }}>{label}</Text>
      {children}
    </View>
  );
}

export const formInputStyle = {
  minHeight: 50,
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderRadius: 16,
  backgroundColor: colors.white,
  borderWidth: 1,
  borderColor: '#E8D9C8',
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 16,
  color: colors.dark,
};
