import React from 'react';
import { View, Text } from 'react-native';

// Centered "kosmiks" wordmark used as the header on the dashboard pages.
// `left` / `right` hold an action (back, add…) at either edge without shifting
// the wordmark off-centre.
export default function BrandHeader({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 52, paddingTop: 8, paddingBottom: 10 }}>
      <Text accessibilityRole="header" style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, lineHeight: 28, color: '#423120' }}>
        kosmiks
      </Text>
      {left ? (
        <View style={{ position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center' }}>{left}</View>
      ) : null}
      {right ? (
        <View style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}>{right}</View>
      ) : null}
    </View>
  );
}
