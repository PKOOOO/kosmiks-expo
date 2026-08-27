import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../../config/constants';

const PROVIDER_STATUS_KEY = 'providerStatus';
// Cache must be scoped per-user so a previous ACTIVE provider's cached status
// doesn't leak to a new entrepreneur signing in on the same device.
const statusKeyFor = (uid: string) => `${PROVIDER_STATUS_KEY}:${uid}`;

const ADMIN_API_KEY = process.env.EXPO_PUBLIC_ADMIN_API_KEY || '';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const white = '#FFFFFF';

const TITLES: Record<string, string> = {
  PHASE1_PENDING: 'Reviewing your application',
  PHASE2_PENDING: 'Verifying your documents',
};

const NEXT_ROUTES: Record<string, string> = {
  PHASE1_APPROVED: '/(onboarding)/phase2',
  PHASE2_APPROVED: '/(onboarding)/phase3',
  ACTIVE:          '/(provider)/bookings',
  REJECTED:        '/(onboarding)/rejected',
};

export default function PendingScreen() {
  const router = useRouter();
  const { getToken, signOut, userId } = useAuth();
  const insets = useSafeAreaInsets();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [status, setStatus] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      const res = await fetch(`${API_BASE_URL}/provider/apply/status`, {
        headers: {
          Authorization: `Bearer ${ADMIN_API_KEY}`,
          'X-User-Token': token ?? '',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      const s: string = data.status;
      setStatus(s);
      const next = NEXT_ROUTES[s];
      if (next) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        // Cache whenever the provider lands on their dashboard.
        if (next === '/(provider)/bookings' && userId) await AsyncStorage.setItem(statusKeyFor(userId), 'ACTIVE');
        router.replace(next as any);
      }
    } catch {}
  }, [router]);

  // Check cache first — if ACTIVE, redirect instantly without showing this screen
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(statusKeyFor(userId)).then(cached => {
      if (cached === 'ACTIVE') {
        router.replace('/(provider)/bookings' as any);
        // Background-refresh the cache
        checkStatus();
      } else {
        setInitializing(false);
        checkStatus();
        intervalRef.current = setInterval(checkStatus, 30000);
      }
    });
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [userId]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in' as any);
  };

  const title = (status && TITLES[status]) ?? 'Under review';

  if (initializing) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#F4EDE5', justifyContent: 'center', alignItems: 'center', marginBottom: 28 }}>
          <Ionicons name="hourglass-outline" size={44} color={darkBrown} />
        </View>

        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, color: darkBrown, textAlign: 'center', marginBottom: 24 }}>
          {title}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="small" color={beige} />
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#aaa' }}>
            Checking for updates…
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSignOut}
          style={{ borderWidth: 1.5, borderColor: beige, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: darkBrown }}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
