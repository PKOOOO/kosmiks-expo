import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { classifyError, describeError, isServerHealthy } from '@/lib/api';
import { useIsOffline, useOnReconnect } from '@/lib/network';

const darkBrown = '#423120';
const white = '#FFFFFF';

type ErrorStateProps = {
  /** Whatever the screen caught. Never rendered directly. */
  error: unknown;
  onRetry?: () => void | Promise<unknown>;
  /** Smaller variant for sections inside a scrolling page. */
  compact?: boolean;
  style?: ViewStyle;
};

/**
 * Friendly replacement for raw error text. Shows Finnish copy based on what
 * went wrong, retries automatically when the connection comes back, and asks
 * the health endpoint whether a "network" failure is really a server outage.
 */
export default function ErrorState({ error, onRetry, compact = false, style }: ErrorStateProps) {
  const isOffline = useIsOffline();
  const [serverDown, setServerDown] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  useOnReconnect(() => {
    void retry();
  });

  // The device is online but the request still failed to connect: check
  // whether our backend is the one that's down.
  useEffect(() => {
    let cancelled = false;
    setServerDown(false);
    if (!isOffline && classifyError(error) === 'offline') {
      isServerHealthy().then((healthy) => {
        if (!cancelled) setServerDown(!healthy);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [error, isOffline]);

  const copy = serverDown ? describeError(new Error('HTTP 503')) : describeError(error, isOffline);
  const icon = isOffline ? 'cloud-offline-outline' : serverDown ? 'construct-outline' : 'alert-circle-outline';

  return (
    <View style={[styles.container, compact && styles.compact, style]}>
      <Ionicons name={icon} size={compact ? 24 : 30} color={darkBrown} />
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.message}>{copy.message}</Text>
      {onRetry && (
        <TouchableOpacity
          style={styles.button}
          onPress={retry}
          disabled={retrying}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          {retrying ? (
            <ActivityIndicator size="small" color={white} />
          ) : (
            <>
              <Ionicons name="refresh" size={17} color={white} />
              <Text style={styles.buttonText}>Yritä uudelleen</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  compact: {
    paddingVertical: 20,
  },
  title: {
    marginTop: 10,
    fontFamily: 'Philosopher-Bold',
    fontSize: 18,
    color: darkBrown,
    textAlign: 'center',
  },
  message: {
    marginTop: 6,
    fontFamily: 'Philosopher-Regular',
    fontSize: 15,
    lineHeight: 21,
    color: darkBrown,
    opacity: 0.8,
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
    minWidth: 160,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: darkBrown,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 15,
    color: white,
  },
});
