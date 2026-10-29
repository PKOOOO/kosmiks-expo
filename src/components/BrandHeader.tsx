import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import KosmiksLogo from '@/components/KosmiksLogo';

// Centered Kosmiks logo used as the header on the dashboard pages.
// `left` / `right` hold an action (back, add…) at either edge without shifting
// the wordmark off-centre. Tapping the logo opens the customer app, the same
// as the logo in the customer app's own header.
export default function BrandHeader({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 52, paddingTop: 8, paddingBottom: 10 }}>
      <TouchableOpacity
        onPress={() => router.replace('/')}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Open the Kosmiks app"
      >
        <KosmiksLogo size={28} />
      </TouchableOpacity>
      {left ? (
        <View style={{ position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center' }}>{left}</View>
      ) : null}
      {right ? (
        <View style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}>{right}</View>
      ) : null}
    </View>
  );
}
