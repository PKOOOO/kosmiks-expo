import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOffline } from '@/lib/network';

const darkBrown = '#423120';
const white = '#FFFFFF';
const BANNER_HEIGHT = 34;
const RESTORED_VISIBLE_MS = 2000;

/**
 * App-wide connection banner, mounted once in the root layout. Slides in under
 * the status bar while offline; on reconnect it briefly says the connection is
 * back, then slides away. It never blocks touches on the screen below.
 */
export default function OfflineBanner() {
  const isOffline = useIsOffline();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'hidden' | 'offline' | 'restored'>('hidden');
  const translateY = useRef(new Animated.Value(-(BANNER_HEIGHT + 60))).current;

  useEffect(() => {
    if (isOffline) {
      setMode('offline');
      return;
    }
    if (mode === 'offline') {
      setMode('restored');
      const timer = setTimeout(() => setMode('hidden'), RESTORED_VISIBLE_MS);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline]);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: mode === 'hidden' ? -(BANNER_HEIGHT + insets.top) : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [mode, insets.top, translateY]);

  const restored = mode === 'restored';

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { paddingTop: insets.top, height: BANNER_HEIGHT + insets.top, transform: [{ translateY }] }]}
    >
      <Ionicons name={restored ? 'wifi' : 'cloud-offline-outline'} size={16} color={white} />
      <Text style={styles.text}>{restored ? 'Yhteys palautettu' : 'Ei internetyhteyttä'}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: darkBrown,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 14,
    color: white,
  },
});
