import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="phase1" />
      <Stack.Screen name="phase2" />
      <Stack.Screen name="phase3" />
      <Stack.Screen name="pending" />
      <Stack.Screen name="rejected" />
    </Stack>
  );
}
