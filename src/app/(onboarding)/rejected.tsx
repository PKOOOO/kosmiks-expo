import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../../config/constants';

const ADMIN_API_KEY = process.env.EXPO_PUBLIC_ADMIN_API_KEY || '';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const white = '#FFFFFF';
const red = '#c00';

export default function RejectedScreen() {
  const router = useRouter();
  const { getToken, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in' as any);
  };
  const insets = useSafeAreaInsets();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getTokenRef.current();
        const res = await fetch(`${API_BASE_URL}/provider/apply/status`, {
          headers: {
            Authorization: `Bearer ${ADMIN_API_KEY}`,
            'X-User-Token': token ?? '',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setReason(data.application?.rejectedReason ?? null);
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
        <View style={{
          width: 96, height: 96, borderRadius: 48,
          backgroundColor: '#fff0f0', justifyContent: 'center', alignItems: 'center', marginBottom: 24,
        }}>
          <Ionicons name="close-circle-outline" size={52} color={red} />
        </View>

        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 24, color: darkBrown, textAlign: 'center', marginBottom: 12 }}>
          Application not approved
        </Text>

        {loading
          ? <ActivityIndicator color={beige} style={{ marginBottom: 16 }} />
          : reason
            ? (
              <View style={{ backgroundColor: '#fff0f0', borderRadius: 12, padding: 16, marginBottom: 16, width: '100%' }}>
                <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: red, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Reason
                </Text>
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: '#c00', lineHeight: 20 }}>
                  {reason}
                </Text>
              </View>
            )
            : null
        }

        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22 }}>
          If you believe this is a mistake, contact us at{' '}
          <Text style={{ fontFamily: 'Philosopher-Bold', color: darkBrown }}>support@servey.fi</Text>
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          onPress={handleSignOut}
          style={{ borderWidth: 1.5, borderColor: beige, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: darkBrown }}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
