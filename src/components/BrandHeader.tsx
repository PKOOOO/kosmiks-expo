import React from 'react';
import { View } from 'react-native';
import KosmiksLogo from '@/components/KosmiksLogo';

// Centered Kosmiks logo used as the header on the dashboard pages.
// `left` / `right` hold an action (back, add…) at either edge without shifting
// the wordmark off-centre.
export default function BrandHeader({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 52, paddingTop: 8, paddingBottom: 10 }}>
      <View accessibilityRole="header">
        <KosmiksLogo size={28} />
      </View>
      {left ? (
        <View style={{ position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center' }}>{left}</View>
      ) : null}
      {right ? (
        <View style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}>{right}</View>
      ) : null}
    </View>
  );
}
