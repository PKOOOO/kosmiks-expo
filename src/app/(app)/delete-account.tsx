// src/app/(app)/delete-account.tsx — the person deletes their own account.
// What is erased and what is kept is explained on screen; the server
// (DELETE /api/user/account) refuses while there are upcoming bookings or
// unwithdrawn earnings, and for admins.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useClerk } from '@clerk/clerk-expo';
import Header from '@/components/Header';
import { API_ENDPOINTS } from '@/config/constants';
import { apiFetch, apiHeaders, describeError } from '@/lib/api';
import { PUSH_TOKEN_STORAGE_KEY } from '@/lib/push';
import { useT, type TKey } from '@/i18n';

const darkBrown = '#423120';
const beige = '#D9C7AF';
const sand = '#F4EDE5';
const red = '#B3261E';
const muted = '#8A7A6A';

const BLOCKED: Record<string, TKey> = {
  admin: 'deleteAccount.blockedAdmin',
  upcoming_bookings: 'deleteAccount.blockedUpcoming',
  provider_upcoming: 'deleteAccount.blockedProviderUpcoming',
  provider_balance: 'deleteAccount.blockedBalance',
};

export default function DeleteAccountScreen() {
  const { t } = useT();
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const word = t('deleteAccount.confirmWord');
  const ready = confirmText.trim().toUpperCase() === word.toUpperCase();

  const handleDelete = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const userToken = await getToken();
      const res = await apiFetch(
        API_ENDPOINTS.USER_ACCOUNT,
        { method: 'DELETE', headers: apiHeaders(userToken) },
        { timeoutMs: 30000, retry: false },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const key = typeof body?.code === 'string' ? BLOCKED[body.code] : undefined;
        Alert.alert(t('deleteAccount.notDeleted'), key ? t(key) : t('deleteAccount.failed'));
        return;
      }
      // The server already removed the login and push tokens; tidy up the phone.
      await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY).catch(() => {});
      await signOut().catch(() => {});
      router.replace('/');
      Alert.alert(t('deleteAccount.doneTitle'), t('deleteAccount.doneBody'));
    } catch (error) {
      Alert.alert(t('deleteAccount.notDeleted'), describeError(error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!isSignedIn) return null;

  const erased: TKey[] = ['deleteAccount.erased1', 'deleteAccount.erased2', 'deleteAccount.erased3'];
  const kept: TKey[] = ['deleteAccount.kept1', 'deleteAccount.kept2'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right']}>
      <Header title="KOSMIKS" showBack showMenu={false} onBackPress={() => router.back()} disableSafeAreaPadding />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 26, color: darkBrown, marginBottom: 8 }}>
            {t('deleteAccount.title')}
          </Text>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, lineHeight: 22, color: muted, marginBottom: 20 }}>
            {t('deleteAccount.intro')}
          </Text>

          <View style={{ backgroundColor: sand, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: darkBrown, marginBottom: 8 }}>{t('deleteAccount.erasedTitle')}</Text>
            {erased.map((k) => (
              <View key={k} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                <Ionicons name="trash-outline" size={16} color={red} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontFamily: 'Philosopher-Regular', fontSize: 14, lineHeight: 20, color: darkBrown }}>{t(k)}</Text>
              </View>
            ))}
          </View>

          <View style={{ backgroundColor: sand, borderRadius: 18, padding: 16, marginBottom: 24 }}>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: darkBrown, marginBottom: 8 }}>{t('deleteAccount.keptTitle')}</Text>
            {kept.map((k) => (
              <View key={k} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                <Ionicons name="document-text-outline" size={16} color={muted} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontFamily: 'Philosopher-Regular', fontSize: 14, lineHeight: 20, color: darkBrown }}>{t(k)}</Text>
              </View>
            ))}
          </View>

          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: darkBrown, marginBottom: 8 }}>
            {t('deleteAccount.typeToConfirm', { word })}
          </Text>
          <TextInput
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={word}
            placeholderTextColor={beige}
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: ready ? red : beige,
              paddingHorizontal: 16, fontFamily: 'Philosopher-Bold', fontSize: 17, color: darkBrown, marginBottom: 16,
            }}
          />

          <TouchableOpacity
            onPress={handleDelete}
            disabled={!ready || busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={{ height: 52, borderRadius: 26, backgroundColor: ready ? red : '#E8D9C8', alignItems: 'center', justifyContent: 'center' }}
          >
            {busy
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: ready ? '#FFFFFF' : muted }}>{t('deleteAccount.button')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
