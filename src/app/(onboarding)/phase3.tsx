import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, Alert, Image,
  KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/config/constants';
import AddressMapPicker from '@/components/AddressMapPicker';

const ADMIN_API_KEY = process.env.EXPO_PUBLIC_ADMIN_API_KEY || '';
const PROVIDER_STATUS_KEY = 'providerStatus';
// Cache must be scoped per-user so a previous ACTIVE provider's cached status
// doesn't leak to a new entrepreneur signing in on the same device.
const statusKeyFor = (uid: string) => `${PROVIDER_STATUS_KEY}:${uid}`;

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const white = '#FFFFFF';
const red = '#c00';

const TOTAL_STEPS = 6;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type DaySlot = { dayOfWeek: number; startTime: string; endTime: string; isOpen: boolean };

const DEFAULT_HOURS: DaySlot[] = DAYS.map((_, i) => ({
  dayOfWeek: i,
  startTime: '09:00',
  endTime: '18:00',
  isOpen: i >= 1 && i <= 5, // Mon–Fri open, Sat/Sun closed
}));

const QUESTIONS = [
  { question: "What's your salon called?" },
  { question: 'Give customers a one-liner', hint: 'Shown as the tagline on the map · optional' },
  { question: 'Tell customers about your salon', hint: 'Optional — you can update this anytime' },
  { question: 'Pin your location', hint: 'Drag the pin or search — this is where customers find you on the map' },
  { question: 'When are you open?', hint: 'Set your weekly schedule' },
  { question: 'Add salon photos', hint: 'At least 1 photo required · up to 6' },
];

const bigInput = {
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 20,
  color: darkBrown,
  borderWidth: 2,
  borderColor: beige,
  borderRadius: 14,
  paddingHorizontal: 18,
  paddingVertical: 16,
  backgroundColor: white,
};

const timeInput = {
  borderWidth: 2,
  borderColor: beige,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 8,
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 16,
  color: darkBrown,
  width: 76,
  textAlign: 'center' as const,
  backgroundColor: white,
};

export default function Phase3Screen() {
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const insets = useSafeAreaInsets();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [step, setStep] = useState(0);
  const [saloonId, setSaloonId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [salonName, setSalonName] = useState('');
  const [shortIntro, setShortIntro] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [hours, setHours] = useState<DaySlot[]>(DEFAULT_HOURS);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const salonNameRef = useRef<TextInput>(null);
  const shortIntroRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);

  const buildHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getTokenRef.current();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_API_KEY}`,
      'X-User-Token': token ?? '',
    };
  }, []);

  // Load existing saloon to pre-fill name + address
  useEffect(() => {
    (async () => {
      try {
        const headers = await buildHeaders();
        const res = await fetch(`${API_BASE_URL}/provider/saloon`, { headers });
        if (!res.ok) return;
        const saloon = await res.json();
        if (saloon?.id) {
          setSaloonId(saloon.id);
          setSalonName(saloon.name ?? '');
          setAddress(saloon.address ?? '');
          if (typeof saloon.latitude === 'number') setLatitude(saloon.latitude);
          if (typeof saloon.longitude === 'number') setLongitude(saloon.longitude);
        }
      } catch {} finally {
        setLoadingData(false);
      }
    })();
  }, [buildHeaders]);

  // Auto-focus text inputs on step change
  useEffect(() => {
    const refs = [salonNameRef, shortIntroRef, descriptionRef, null, null, null];
    const ref = refs[step];
    if (ref) {
      const t = setTimeout(() => ref.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [step]);

  const validate = (): boolean => {
    if (step === 0 && !salonName.trim()) { setError('Please enter your salon name'); return false; }
    if (step === 3 && (latitude == null || longitude == null)) { setError('Please pin your salon location on the map'); return false; }
    if (step === 5 && photos.length === 0) { setError('Please add at least one photo'); return false; }
    setError('');
    return true;
  };

  const goNext = () => {
    if (!validate()) return;
    if (step === TOTAL_STEPS - 1) { handleSubmit(); return; }
    setStep(s => s + 1);
  };

  const goBack = () => {
    setError('');
    setStep(s => s - 1);
  };

  const updateHour = (dayOfWeek: number, field: keyof DaySlot, value: string | boolean) => {
    setHours(prev => prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d));
  };

  const pickAndUpload = async () => {
    if (photos.length >= 6) {
      Alert.alert('Limit reached', 'Maximum 6 photos allowed.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];

    setUploading(true);
    try {
      const token = await getTokenRef.current();
      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? 'photo.jpg',
      } as any);
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ADMIN_API_KEY}`,
          'X-User-Token': token ?? '',
        },
        body: form,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const { url } = await res.json();
      setPhotos(prev => [...prev, url]);
      setError('');
    } catch {
      Alert.alert('Upload failed', 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!saloonId) {
      Alert.alert('Error', 'Salon not found. Please try again.');
      return;
    }
    setSubmitting(true);
    try {
      const headers = await buildHeaders();

      // 1. Save salon info + photos
      const patchRes = await fetch(`${API_BASE_URL}/saloons/${saloonId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name: salonName.trim(),
          shortIntro: shortIntro.trim() || null,
          description: description.trim() || null,
          address: address.trim(),
          latitude,
          longitude,
          images: photos.map(url => ({ url })),
        }),
      });
      if (!patchRes.ok) throw new Error('Failed to save salon info');

      // 2. Save opening hours
      const slotsRes = await fetch(`${API_BASE_URL}/saloons/${saloonId}/time-slots`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ timeSlots: hours }),
      });
      if (!slotsRes.ok) throw new Error('Failed to save opening hours');

      // 3. Activate the provider account
      const phase3Res = await fetch(`${API_BASE_URL}/provider/apply/phase3`, {
        method: 'POST',
        headers,
      });
      if (!phase3Res.ok) {
        const body = await phase3Res.json().catch(() => ({}));
        throw new Error(body.error ?? `${phase3Res.status}`);
      }

      // 4. Seed cache so next open skips pending screen instantly
      if (userId) await AsyncStorage.setItem(statusKeyFor(userId), 'ACTIVE');

      router.replace('/(provider)/bookings' as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const q = QUESTIONS[step];

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <TextInput
            ref={salonNameRef}
            value={salonName}
            onChangeText={v => { setSalonName(v); setError(''); }}
            placeholder="Beauty Studio Servey"
            placeholderTextColor="#ccc"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={goNext}
            style={bigInput}
          />
        );

      case 1:
        return (
          <TextInput
            ref={shortIntroRef}
            value={shortIntro}
            onChangeText={v => { setShortIntro(v); setError(''); }}
            placeholder="Premium beauty treatments in Helsinki"
            placeholderTextColor="#ccc"
            autoCapitalize="sentences"
            returnKeyType="next"
            onSubmitEditing={goNext}
            style={bigInput}
          />
        );

      case 2:
        return (
          <TextInput
            ref={descriptionRef}
            value={description}
            onChangeText={v => { setDescription(v); setError(''); }}
            placeholder="Tell customers about your salon, specialties, and vibe…"
            placeholderTextColor="#ccc"
            autoCapitalize="sentences"
            multiline
            style={[bigInput, { minHeight: 140, textAlignVertical: 'top' }]}
          />
        );

      // case 3 (location) is rendered full-screen outside the ScrollView — see below.

      case 4:
        return (
          <View>
            {hours.map((day, i) => (
              <View
                key={day.dayOfWeek}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: i < hours.length - 1 ? 1 : 0,
                  borderBottomColor: lightBeige,
                }}
              >
                <Text style={{
                  fontFamily: 'Philosopher-Bold', fontSize: 14,
                  color: day.isOpen ? darkBrown : '#bbb', width: 44,
                }}>
                  {DAYS[day.dayOfWeek]}
                </Text>
                <Switch
                  value={day.isOpen}
                  onValueChange={v => updateHour(day.dayOfWeek, 'isOpen', v)}
                  trackColor={{ false: beige, true: darkBrown }}
                  thumbColor={white}
                  style={{ marginRight: 12 }}
                />
                {day.isOpen ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      value={day.startTime}
                      onChangeText={v => updateHour(day.dayOfWeek, 'startTime', v)}
                      placeholder="09:00"
                      placeholderTextColor="#bbb"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      style={timeInput}
                    />
                    <Text style={{ fontFamily: 'Philosopher-Regular', color: '#aaa', fontSize: 14 }}>–</Text>
                    <TextInput
                      value={day.endTime}
                      onChangeText={v => updateHour(day.dayOfWeek, 'endTime', v)}
                      placeholder="18:00"
                      placeholderTextColor="#bbb"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      style={timeInput}
                    />
                  </View>
                ) : (
                  <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#bbb' }}>Closed</Text>
                )}
              </View>
            ))}
          </View>
        );

      case 5:
        return (
          <View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {photos.map((url, i) => (
                <View key={i} style={{ position: 'relative' }}>
                  <Image
                    source={{ uri: url }}
                    style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: lightBeige }}
                  />
                  <TouchableOpacity
                    onPress={() => removePhoto(i)}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 4,
                    }}
                  >
                    <Ionicons name="close" size={14} color={white} />
                  </TouchableOpacity>
                </View>
              ))}

              {photos.length < 6 && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={pickAndUpload}
                  disabled={uploading}
                  style={{
                    width: 100, height: 100, borderRadius: 12,
                    borderWidth: 2, borderColor: beige, borderStyle: 'dashed',
                    justifyContent: 'center', alignItems: 'center',
                    backgroundColor: lightBeige,
                  }}
                >
                  {uploading
                    ? <ActivityIndicator color={darkBrown} />
                    : <>
                        <Ionicons name="add" size={28} color={darkBrown} />
                        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 11, color: darkBrown, marginTop: 2 }}>
                          Add photo
                        </Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </View>

            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: '#aaa', marginTop: 14 }}>
              {photos.length}/6 photos · JPEG/PNG · Auto-compressed
            </Text>
          </View>
        );
    }
  };

  if (loadingData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: white, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={darkBrown} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Progress bar — identical to phase1/phase2 */}
        <View style={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={goBack}
              style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center', opacity: step === 0 ? 0 : 1 }}
              disabled={step === 0}
            >
              <Ionicons name="arrow-back" size={22} color={darkBrown} />
            </TouchableOpacity>
            <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <View key={i} style={{ flex: 1, height: 3.5, borderRadius: 2, backgroundColor: i <= step ? darkBrown : beige }} />
              ))}
            </View>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: darkBrown, width: 36, textAlign: 'right' }}>
              {step + 1}/{TOTAL_STEPS}
            </Text>
          </View>
        </View>

        {/* Content — the location step is a full-screen map; all others scroll. */}
        {step === 3 ? (
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 28, paddingTop: 20, paddingBottom: 14 }}>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 26, color: darkBrown, lineHeight: 32, marginBottom: q.hint ? 6 : 0 }}>
                {q.question}
              </Text>
              {q.hint ? (
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#999', lineHeight: 18 }}>
                  {q.hint}
                </Text>
              ) : null}
              {error ? (
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: red, marginTop: 8 }}>
                  {error}
                </Text>
              ) : null}
            </View>
            <AddressMapPicker
              initialAddress={address}
              initialLat={latitude}
              initialLng={longitude}
              onChange={({ address: addr, latitude: lat, longitude: lng }) => {
                setAddress(addr);
                setLatitude(lat);
                setLongitude(lng);
                setError('');
              }}
            />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 48, paddingBottom: 24 }}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 30, color: darkBrown, lineHeight: 38, marginBottom: q.hint ? 8 : 28 }}>
              {q.question}
            </Text>
            {q.hint ? (
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: '#999', marginBottom: 24, lineHeight: 20 }}>
                {q.hint}
              </Text>
            ) : null}
            {renderStep()}
            {error ? (
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: red, marginTop: 12 }}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
        )}

        {/* Continue / Finish button */}
        <View style={{ paddingHorizontal: 28, paddingBottom: insets.bottom + 16, paddingTop: 8 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={goNext}
            disabled={submitting || uploading}
            style={{ backgroundColor: darkBrown, borderRadius: 14, paddingVertical: 17, alignItems: 'center' }}
          >
            {submitting
              ? <ActivityIndicator color={white} />
              : <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: white }}>
                  {step === TOTAL_STEPS - 1 ? 'Finish setup' : 'Continue'}
                </Text>
            }
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
