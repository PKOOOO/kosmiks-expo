import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator,
  Animated, Easing, AppState, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { API_BASE_URL } from '@/config/constants';

const PROVIDER_STATUS_KEY = 'providerStatus';
// Cache must be scoped per-user so a previous ACTIVE provider's cached status
// doesn't leak to a new entrepreneur signing in on the same device.
const statusKeyFor = (uid: string) => `${PROVIDER_STATUS_KEY}:${uid}`;

const ADMIN_API_KEY = process.env.EXPO_PUBLIC_ADMIN_API_KEY || '';
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Polling only runs while the app is in the foreground; a push from the
// approve/reject routes or returning to the app triggers an immediate check.
const POLL_MS = 10000;
const STATUS_PUSH_TYPES = ['provider_phase1_approved', 'provider_phase2_approved', 'provider_rejected'];

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const sand = '#EDE3D8';
const muted = '#8A7F75';
const white = '#FFFFFF';

const NEXT_ROUTES: Record<string, string> = {
  PHASE1_APPROVED: '/(onboarding)/phase2',
  PHASE2_APPROVED: '/(onboarding)/phase3',
  ACTIVE:          '/(provider)/bookings',
  REJECTED:        '/(onboarding)/rejected',
};

const COPY: Record<string, { title: string; body: string }> = {
  PHASE1_PENDING: {
    title: "We're reviewing your application",
    body: 'Our team checks every new provider by hand. This usually takes less than 24 hours.',
  },
  PHASE2_PENDING: {
    title: "We're verifying your documents",
    body: 'We check your qualifications and bank details by hand. This usually takes less than 24 hours.',
  },
};

const STAGES = [
  { title: 'Application', detail: 'Your details and services' },
  { title: 'Verification', detail: 'Documents and bank details' },
  { title: 'Salon setup', detail: 'Photos, hours and location' },
];

type StageState = 'done' | 'review' | 'upcoming';

// Index of the stage currently under review.
const reviewIndexFor = (status: string | null) => (status === 'PHASE2_PENDING' ? 1 : 0);

const formatChecked = (d: Date) =>
  d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function PendingScreen() {
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const insets = useSafeAreaInsets();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [status, setStatus] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const leavingRef = useRef(false);
  const inFlightRef = useRef(false);

  const stopPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const checkStatus = useCallback(async () => {
    if (leavingRef.current || inFlightRef.current) return;
    inFlightRef.current = true;
    setChecking(true);
    try {
      const token = await getTokenRef.current();
      const res = await fetch(`${API_BASE_URL}/provider/apply/status`, {
        // Never let Android's HTTP layer hand back a stale status.
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${ADMIN_API_KEY}`,
          'X-User-Token': token ?? '',
          'Cache-Control': 'no-cache',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      const s: string = data.status;
      setStatus(s);
      setLastChecked(new Date());
      const next = NEXT_ROUTES[s];
      if (next) {
        leavingRef.current = true;
        stopPolling();
        // Cache whenever the provider lands on their dashboard.
        if (next === '/(provider)/bookings' && userId) await AsyncStorage.setItem(statusKeyFor(userId), 'ACTIVE');
        router.replace(next as any);
      }
    } catch {
      // Network blip — the next poll or foreground event retries.
    } finally {
      inFlightRef.current = false;
      setChecking(false);
      setInitializing(false);
    }
  }, [router, userId]);

  const startPolling = useCallback(() => {
    stopPolling();
    if (leavingRef.current) return;
    intervalRef.current = setInterval(checkStatus, POLL_MS);
  }, [checkStatus]);

  // Check cache first — if ACTIVE, redirect instantly without showing this screen
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(statusKeyFor(userId)).then(cached => {
      if (cached === 'ACTIVE') {
        leavingRef.current = true;
        router.replace('/(provider)/bookings' as any);
        return;
      }
      checkStatus();
      startPolling();
    });
    return stopPolling;
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Android suspends JS timers in the background, so check the moment the
  // app comes back instead of waiting for the next interval.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        checkStatus();
        startPolling();
      } else {
        stopPolling();
      }
    });
    return () => sub.remove();
  }, [checkStatus, startPolling]);

  // The approve/reject routes push to the provider — react to it instantly,
  // whether it arrives in the foreground or the user taps it.
  useEffect(() => {
    if (isExpoGo) return;
    const Notifications = require('expo-notifications');
    const isStatusPush = (n: any) => STATUS_PUSH_TYPES.includes(n?.request?.content?.data?.type);
    const received = Notifications.addNotificationReceivedListener((n: any) => {
      if (isStatusPush(n)) checkStatus();
    });
    const tapped = Notifications.addNotificationResponseReceivedListener((r: any) => {
      if (isStatusPush(r?.notification)) checkStatus();
    });
    return () => { received.remove(); tapped.remove(); };
  }, [checkStatus]);

  // Soft "breathing" ring behind the active stage marker.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  if (initializing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: white, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={darkBrown} />
      </SafeAreaView>
    );
  }

  const copy = (status ? COPY[status] : undefined) ?? COPY.PHASE1_PENDING;
  const reviewIndex = reviewIndexFor(status);
  const stageState = (i: number): StageState =>
    i < reviewIndex ? 'done' : i === reviewIndex ? 'review' : 'upcoming';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 64, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={statusPill}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#C08A3E' }} />
          <Text style={statusPillText}>In review</Text>
        </View>

        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 30, lineHeight: 38, color: darkBrown, marginTop: 18 }}>
          {copy.title}
        </Text>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, lineHeight: 22, color: muted, marginTop: 10 }}>
          {copy.body}
        </Text>

        {/* Progress timeline */}
        <View style={timelineCard}>
          {STAGES.map((stage, i) => {
            const state = stageState(i);
            const isLast = i === STAGES.length - 1;
            return (
              <View key={stage.title} style={{ flexDirection: 'row' }}>
                <View style={{ width: 32, alignItems: 'center' }}>
                  <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                    {state === 'review' && (
                      <Animated.View
                        style={{
                          position: 'absolute', width: 28, height: 28, borderRadius: 14,
                          backgroundColor: darkBrown,
                          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] }),
                          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
                        }}
                      />
                    )}
                    <View style={[
                      marker,
                      state === 'done' && { backgroundColor: darkBrown, borderColor: darkBrown },
                      state === 'review' && { backgroundColor: white, borderColor: darkBrown },
                    ]}>
                      {state === 'done' && <Ionicons name="checkmark" size={15} color={white} />}
                      {state === 'review' && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: darkBrown }} />}
                      {state === 'upcoming' && <Ionicons name="lock-closed" size={12} color={muted} />}
                    </View>
                  </View>
                  {!isLast && (
                    <View style={{
                      width: 2, flex: 1, minHeight: 26, marginVertical: 4, borderRadius: 1,
                      backgroundColor: state === 'done' ? darkBrown : beige,
                    }} />
                  )}
                </View>

                <View style={{ flex: 1, marginLeft: 14, paddingBottom: isLast ? 0 : 22 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
                    <Text style={{
                      fontFamily: 'Philosopher-Bold', fontSize: 16,
                      color: state === 'upcoming' ? muted : darkBrown,
                    }}>
                      {stage.title}
                    </Text>
                    <Text style={{
                      fontFamily: 'Philosopher-Bold', fontSize: 12,
                      color: state === 'review' ? '#A0702C' : muted,
                    }}>
                      {state === 'done' ? 'Approved' : state === 'review' ? 'In review' : 'Next'}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: muted, marginTop: 2 }}>
                    {stage.detail}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 22, alignItems: 'flex-start' }}>
          <View style={infoIcon}>
            <Ionicons name="notifications-outline" size={18} color={darkBrown} />
          </View>
          <Text style={{ flex: 1, fontFamily: 'Philosopher-Regular', fontSize: 14, lineHeight: 20, color: '#6F6258' }}>
            We'll send you a notification as soon as you're approved. This page also updates by itself while it's open.
          </Text>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 28, paddingTop: 8, paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          onPress={checkStatus}
          disabled={checking}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, minHeight: 22 }}
        >
          {checking
            ? <ActivityIndicator size="small" color={muted} />
            : <Ionicons name="refresh" size={15} color={muted} />}
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: muted }}>
            {checking
              ? 'Checking…'
              : lastChecked ? `Last checked ${formatChecked(lastChecked)} · Check now` : 'Check now'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.replace('/(app)/(tabs)/' as any)}
          style={{ backgroundColor: darkBrown, borderRadius: 14, paddingVertical: 17, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: white }}>Go home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const statusPill = {
  alignSelf: 'flex-start' as const,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
  paddingHorizontal: 12,
  minHeight: 30,
  borderRadius: 15,
  backgroundColor: '#F7EEDF',
};

const statusPillText = {
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 13,
  color: '#A0702C',
};

const timelineCard = {
  marginTop: 32,
  padding: 20,
  borderRadius: 18,
  backgroundColor: lightBeige,
};

const marker = {
  width: 26,
  height: 26,
  borderRadius: 13,
  borderWidth: 2,
  borderColor: beige,
  backgroundColor: sand,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const infoIcon = {
  width: 36,
  height: 36,
  borderRadius: 18,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: lightBeige,
};
