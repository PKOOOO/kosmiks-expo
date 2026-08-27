import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Switch, SafeAreaView,
  KeyboardAvoidingView, Platform, Image, Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../../../config/constants';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const pageBg = '#EDE3D8';
const white = '#FFFFFF';

const SCREEN_W = Dimensions.get('window').width;
// 3-col photo grid: 16px scroll padding × 2, 16px card padding × 2, 8px gap × 2
const PHOTO_TILE = Math.floor((SCREEN_W - 32 - 32 - 16) / 3);

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type SalonForm = { name: string; description: string; shortIntro: string; address: string };
type DaySlot = { dayOfWeek: number; startTime: string; endTime: string; isOpen: boolean };

const DEFAULT_HOURS: DaySlot[] = DAYS.map((_, i) => ({
  dayOfWeek: i, startTime: '09:00', endTime: '18:00',
  isOpen: i >= 1 && i <= 5,
}));

export default function ProviderSalonScreen() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [saloonId, setSaloonId] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [savedImages, setSavedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<SalonForm>({ name: '', description: '', shortIntro: '', address: '' });
  const [savedForm, setSavedForm] = useState<SalonForm>({ name: '', description: '', shortIntro: '', address: '' });
  const [hours, setHours] = useState<DaySlot[]>(DEFAULT_HOURS);
  const [savedHours, setSavedHours] = useState<DaySlot[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const hasFormChanges = JSON.stringify(form) !== JSON.stringify(savedForm);
  const hasHourChanges = JSON.stringify(hours) !== JSON.stringify(savedHours);
  const hasImageChanges = JSON.stringify(images) !== JSON.stringify(savedImages);
  const hasChanges = hasFormChanges || hasHourChanges || hasImageChanges;

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getTokenRef.current();
    const h: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` };
    if (token) h['X-User-Token'] = token;
    return h;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const headers = await authHeaders();
      const saloonsRes = await fetch(`${API_BASE_URL}/saloons?owned=1`, { headers });
      if (!saloonsRes.ok) throw new Error('Could not load salon');
      const saloons = await saloonsRes.json();
      if (!Array.isArray(saloons) || saloons.length === 0) { setLoading(false); return; }
      const id = saloons[0].id;
      setSaloonId(id);

      const [detailRes, slotsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/saloons/${id}`, { headers }),
        fetch(`${API_BASE_URL}/saloons/${id}/time-slots`, { headers }),
      ]);

      if (detailRes.ok) {
        const salon = await detailRes.json();
        const f: SalonForm = {
          name: salon.name ?? '', description: salon.description ?? '',
          shortIntro: salon.shortIntro ?? '', address: salon.address ?? '',
        };
        setForm(f); setSavedForm(f);
        if (Array.isArray(salon.images)) {
          const urls = salon.images.map((img: { url: string }) => img.url);
          setImages(urls); setSavedImages(urls);
        }
      }

      if (slotsRes.ok) {
        const slots: DaySlot[] = await slotsRes.json();
        if (Array.isArray(slots) && slots.length > 0) {
          const merged = DEFAULT_HOURS.map(def => {
            const found = slots.find(s => s.dayOfWeek === def.dayOfWeek);
            return found ? { dayOfWeek: found.dayOfWeek, startTime: found.startTime, endTime: found.endTime, isOpen: found.isOpen } : def;
          });
          setHours(merged); setSavedHours(merged);
        }
      }
    } catch { setError('Failed to load salon info.'); }
    finally { setLoading(false); }
  }, [authHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!hasChanges) return;
      e.preventDefault();
      Alert.alert('Unsaved Changes', 'You have unsaved changes. Discard them?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, hasChanges]);

  const handleSave = async () => {
    if (!saloonId) return;
    if (!form.name.trim()) return Alert.alert('Required', 'Salon name is required.');
    setSaving(true); setError(null); setSuccessMsg(null);
    try {
      const headers = await authHeaders();
      if (hasFormChanges || hasImageChanges) {
        const res = await fetch(`${API_BASE_URL}/saloons/${saloonId}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
            shortIntro: form.shortIntro.trim() || null,
            address: form.address.trim() || null,
            ...(hasImageChanges && { images: images.map(url => ({ url })) }),
          }),
        });
        if (!res.ok) throw new Error('Failed to save salon info');
        setSavedForm({ ...form });
        if (hasImageChanges) setSavedImages([...images]);
      }
      if (hasHourChanges) {
        const res = await fetch(`${API_BASE_URL}/saloons/${saloonId}/time-slots`, {
          method: 'POST', headers,
          body: JSON.stringify({ timeSlots: hours }),
        });
        if (!res.ok) throw new Error('Failed to save opening hours');
        setSavedHours([...hours]);
      }
      setSuccessMsg('Saved!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setError(e?.message || 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  const pickAndUpload = async () => {
    if (images.length >= 6) { Alert.alert('Limit reached', 'Maximum 6 photos allowed.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const token = await getTokenRef.current();
      const photoForm = new FormData();
      photoForm.append('file', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'photo.jpg' } as any);
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}`, 'X-User-Token': token ?? '' },
        body: photoForm,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const { url } = await res.json();
      setImages(prev => [...prev, url]);
    } catch { Alert.alert('Upload failed', 'Please try again.'); }
    finally { setUploading(false); }
  };

  const removeImage = (index: number) => {
    Alert.alert('Remove photo?', 'This will be removed when you save.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setImages(prev => prev.filter((_, i) => i !== index)) },
    ]);
  };

  const updateHour = (dayOfWeek: number, field: keyof DaySlot, value: string | boolean) => {
    setHours(prev => prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d));
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: pageBg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={darkBrown} />
      </SafeAreaView>
    );
  }

  if (!saloonId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: pageBg, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
        <Ionicons name="storefront-outline" size={52} color={beige} style={{ marginBottom: 14 }} />
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 17, color: darkBrown, textAlign: 'center' }}>No salon found</Text>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: '#888', textAlign: 'center', marginTop: 6 }}>
          Complete your onboarding to set up your salon profile.
        </Text>
      </SafeAreaView>
    );
  }

  const FOOTER_H = 72 + insets.bottom;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pageBg }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
        backgroundColor: pageBg,
      }}>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 22, color: darkBrown }}>
          Salon Profile
        </Text>
        {hasChanges && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#b87a00' }} />
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#b87a00' }}>Unsaved</Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: FOOTER_H + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Banners ──────────────────────────────────────────────────── */}
          {successMsg && (
            <View style={[banner, { backgroundColor: '#e8f5e8', borderColor: '#a8d5a8', marginBottom: 12 }]}>
              <Ionicons name="checkmark-circle" size={16} color="#2d7a2d" />
              <Text style={{ fontFamily: 'Philosopher-Bold', color: '#2d7a2d', fontSize: 14 }}>{successMsg}</Text>
            </View>
          )}
          {error && (
            <View style={[banner, { backgroundColor: '#fff0f0', borderColor: '#ffb3b3', marginBottom: 12 }]}>
              <Ionicons name="alert-circle-outline" size={16} color="#c00" />
              <Text style={{ fontFamily: 'Philosopher-Regular', color: '#c00', fontSize: 14, flex: 1 }}>{error}</Text>
            </View>
          )}

          {/* ══════════════════════════════════════
              CARD: Basic Info
          ══════════════════════════════════════ */}
          <Card>
            <CardHeader icon="storefront-outline" title="Basic Info" />

            <FieldLabel label="Salon Name *" />
            <TextInput
              style={input}
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              placeholder="e.g. Beauty Studio Servey"
              placeholderTextColor="#bbb"
            />

            <FieldLabel label="Short Intro" hint="Tagline shown on the map" />
            <TextInput
              style={[input, { height: 58, textAlignVertical: 'top' }]}
              value={form.shortIntro}
              onChangeText={v => setForm(f => ({ ...f, shortIntro: v }))}
              placeholder="One-line tagline shown on the map"
              placeholderTextColor="#bbb"
              multiline
            />

            <FieldLabel label="Description" />
            <TextInput
              style={[input, { height: 96, textAlignVertical: 'top' }]}
              value={form.description}
              onChangeText={v => setForm(f => ({ ...f, description: v }))}
              placeholder="Tell customers about your salon…"
              placeholderTextColor="#bbb"
              multiline
            />

            <FieldLabel label="Address" />
            <TextInput
              style={input}
              value={form.address}
              onChangeText={v => setForm(f => ({ ...f, address: v }))}
              placeholder="Street address"
              placeholderTextColor="#bbb"
            />
          </Card>

          {/* ══════════════════════════════════════
              CARD: Opening Hours
          ══════════════════════════════════════ */}
          <Card>
            <CardHeader icon="time-outline" title="Opening Hours" />

            {hours.map((day, i) => (
              <View
                key={day.dayOfWeek}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 13,
                  borderBottomWidth: i < hours.length - 1 ? 1 : 0,
                  borderBottomColor: lightBeige,
                  opacity: day.isOpen ? 1 : 0.42,
                }}
              >
                {/* Day label */}
                <Text style={{
                  fontFamily: 'Philosopher-Bold', fontSize: 14,
                  color: darkBrown, width: 42,
                }}>
                  {DAYS[day.dayOfWeek].slice(0, 3)}
                </Text>

                {/* Toggle */}
                <Switch
                  value={day.isOpen}
                  onValueChange={v => updateHour(day.dayOfWeek, 'isOpen', v)}
                  trackColor={{ false: beige, true: darkBrown }}
                  thumbColor={white}
                  style={{ marginRight: 14 }}
                />

                {/* Times or closed label */}
                {day.isOpen ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      style={timeInput}
                      value={day.startTime}
                      onChangeText={v => updateHour(day.dayOfWeek, 'startTime', v)}
                      placeholder="09:00"
                      placeholderTextColor="#bbb"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                    <Text style={{ fontFamily: 'Philosopher-Regular', color: '#aaa', fontSize: 13 }}>—</Text>
                    <TextInput
                      style={timeInput}
                      value={day.endTime}
                      onChangeText={v => updateHour(day.dayOfWeek, 'endTime', v)}
                      placeholder="18:00"
                      placeholderTextColor="#bbb"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                ) : (
                  <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#999' }}>
                    Closed
                  </Text>
                )}
              </View>
            ))}
          </Card>

          {/* ══════════════════════════════════════
              CARD: Photos
          ══════════════════════════════════════ */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="images-outline" size={15} color={darkBrown} />
                <Text style={cardHeaderText}>Photos</Text>
              </View>
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#999' }}>
                {images.length}/6
              </Text>
            </View>

            {/* 3-column grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {images.map((url, i) => (
                <View key={i} style={{ position: 'relative', width: PHOTO_TILE, height: PHOTO_TILE }}>
                  <Image
                    source={{ uri: url }}
                    style={{ width: PHOTO_TILE, height: PHOTO_TILE, borderRadius: 10, backgroundColor: lightBeige }}
                  />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => removeImage(i)}
                    style={{
                      position: 'absolute', top: 5, right: 5,
                      backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 12, padding: 4,
                    }}
                  >
                    <Ionicons name="close" size={13} color={white} />
                  </TouchableOpacity>
                </View>
              ))}

              {images.length < 6 && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={pickAndUpload}
                  disabled={uploading}
                  style={{
                    width: PHOTO_TILE, height: PHOTO_TILE, borderRadius: 10,
                    borderWidth: 1.5, borderColor: beige, borderStyle: 'dashed',
                    backgroundColor: lightBeige,
                    justifyContent: 'center', alignItems: 'center',
                  }}
                >
                  {uploading
                    ? <ActivityIndicator color={darkBrown} size="small" />
                    : <>
                        <Ionicons name="add" size={26} color={darkBrown} />
                        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 11, color: darkBrown, marginTop: 3 }}>
                          Add photo
                        </Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </View>

            {images.length === 0 && (
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#bbb', marginTop: 10, textAlign: 'center' }}>
                Add photos to show customers your salon
              </Text>
            )}
          </Card>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Floating Save Button ───────────────────────────────────────────── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: white,
        borderTopWidth: 1, borderTopColor: beige,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
      }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
          style={{
            backgroundColor: hasChanges ? darkBrown : beige,
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {saving ? (
            <ActivityIndicator color={white} size="small" />
          ) : (
            <>
              <Ionicons
                name={hasChanges ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={18}
                color={hasChanges ? white : '#aaa'}
              />
              <Text style={{
                fontFamily: 'Philosopher-Bold', fontSize: 16,
                color: hasChanges ? white : '#aaa',
              }}>
                {hasChanges ? 'Save Changes' : 'No Changes'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#E8D9C8',
      padding: 16,
      marginBottom: 14,
    }}>
      {children}
    </View>
  );
}

const cardHeaderText = {
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 12,
  color: '#423120',
  textTransform: 'uppercase' as const,
  letterSpacing: 0.9,
};

function CardHeader({ icon, title }: { icon: any; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <Ionicons name={icon} size={15} color="#423120" />
      <Text style={cardHeaderText}>{title}</Text>
    </View>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6, marginTop: 4 }}>
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Text>
      {hint && (
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 11, color: '#bbb' }}>{hint}</Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const input = {
  borderWidth: 1.5,
  borderColor: '#D7C3A7',
  borderRadius: 10,
  paddingHorizontal: 13,
  paddingVertical: 11,
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 15,
  color: '#423120',
  backgroundColor: '#F4EDE5',
  marginBottom: 12,
};

const timeInput = {
  borderWidth: 1.5,
  borderColor: '#D7C3A7',
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 7,
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 15,
  color: '#423120',
  backgroundColor: '#F4EDE5',
  width: 72,
  textAlign: 'center' as const,
};

const banner = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
};
