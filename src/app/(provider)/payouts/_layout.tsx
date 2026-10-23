import { Stack } from 'expo-router';

// Earnings tab: overview → payout detail / bank account, plus a
// "How payouts work" bottom sheet.
export default function EarningsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#EDE3D8' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="bank" />
      <Stack.Screen
        name="how-it-works"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.62],
          sheetGrabberVisible: true,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: '#F4EDE5' },
        }}
      />
    </Stack>
  );
}
