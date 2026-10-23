import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Dimensions, Keyboard, Animated,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/config/constants';
import AddressMapPicker from '@/components/AddressMapPicker';
import { uploadImage } from '@/lib/upload-image';
import StackedPhotos, { AddPhotoButton, MAX_PHOTOS } from '@/components/StackedPhotos';
import { pickSalonPhoto, prepareForUpload } from '@/lib/pick-photo';
import { forwardGeocode } from '@/lib/geocode';

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

const TOTAL_STEPS = 5;

// Photos use the same stacked layout as the provider salon screen.
const PHOTO_CONTENT_WIDTH = Dimensions.get('window').width - 56;

const QUESTIONS = [
  { question: "What's your salon called?" },
  { question: 'Give customers a one-liner', hint: 'Shown as the tagline on the map · optional' },
  { question: 'Tell customers about your salon', hint: 'Optional — you can update this anytime' },
  { question: 'Pin your location', hint: 'Drag the pin or search — this is where customers find you on the map' },
  { question: 'Show off your salon', hint: 'Add at least 1 photo. The first one becomes your cover.' },
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
  const [photos, setPhotos] = useState<string[]>([]);
  // Which slot is uploading: an existing photo index (replace) or 'new'.
  const [uploading, setUploading] = useState<number | 'new' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Drives the stacked-photos scroll effect on the photos step.
  const scrollY = useRef(new Animated.Value(0)).current;

  // Bumping mapRevision remounts the map centred on the current lat/lng
  // (same approach as the provider salon screen).
  const [mapRevision, setMapRevision] = useState(0);
  const [locationQuery, setLocationQuery] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const autoLocatedRef = useRef(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const salonNameRef = useRef<TextInputInstance>(null);
  const shortIntroRef = useRef<TextInputInstance>(null);
  const descriptionRef = useRef<TextInputInstance>(null);

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
    const refs = [salonNameRef, shortIntroRef, descriptionRef, null, null];
    const ref = refs[step];
    if (ref) {
      const t = setTimeout(() => ref.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [step]);

  const validate = (): boolean => {
    if (step === 0 && !salonName.trim()) { setError('Please enter your salon name'); return false; }
    if (step === 3 && (latitude == null || longitude == null)) { setError('Please pin your salon location on the map'); return false; }
    if (step === 4 && photos.length === 0) { setError('Please add at least one photo'); return false; }
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

  const moveMapTo = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setMapRevision(r => r + 1);
    setError('');
  };

  const locateMe = useCallback(async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Location access is off — search for your address instead');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      moveMapTo(position.coords.latitude, position.coords.longitude);
    } catch {
      setError("Couldn't find your location — search for your address instead");
    } finally {
      setLocating(false);
    }
  }, []);

  // First visit to the map with nothing to show: start from the device location.
  useEffect(() => {
    if (step !== 3 || autoLocatedRef.current) return;
    autoLocatedRef.current = true;
    if (latitude == null && longitude == null && !address.trim()) void locateMe();
  }, [step, latitude, longitude, address, locateMe]);

  const runLocationSearch = async () => {
    const query = locationQuery.trim();
    if (!query) return;
    Keyboard.dismiss();
    setSearchingLocation(true);
    try {
      const hit = await forwardGeocode(
        query,
        latitude != null && longitude != null ? { latitude, longitude } : null,
      );
      if (hit) moveMapTo(hit.latitude, hit.longitude);
      else setError('No match for that address — try adding the city');
    } catch {
      setError('No match for that address — try adding the city');
    } finally {
      setSearchingLocation(false);
    }
  };

  const pickAndUpload = async (replaceIndex?: number) => {
    if (replaceIndex == null && photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `Maximum ${MAX_PHOTOS} photos allowed.`);
      return;
    }
    const asset = await pickSalonPhoto();
    if (!asset) return;

    setUploadProgress(0);
    setUploading(replaceIndex ?? 'new');
    try {
      const photoUri = await prepareForUpload(asset);
      const token = await getTokenRef.current();
      const { url } = await uploadImage({
        uri: photoUri,
        authorization: `Bearer ${ADMIN_API_KEY}`,
        userToken: token ?? undefined,
        onProgress: setUploadProgress,
      });
      setPhotos(prev => replaceIndex == null
        ? [...prev, url]
        : prev.map((current, i) => (i === replaceIndex ? url : current)));
      setError('');
    } catch {
      Alert.alert('Upload failed', 'Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const replacePhoto = (index: number) => { void pickAndUpload(index); };

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

      // 2. Activate the provider account
      const phase3Res = await fetch(`${API_BASE_URL}/provider/apply/phase3`, {
        method: 'POST',
        headers,
      });
      if (!phase3Res.ok) {
        const body = await phase3Res.json().catch(() => ({}));
        throw new Error(body.error ?? `${phase3Res.status}`);
      }

      // 3. Seed cache so next open skips pending screen instantly
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
            placeholder="Beauty Studio Kosmiks"
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
            style={[bigInput, { fontSize: 17, height: 112, textAlignVertical: 'top' }]}
          />
        );

      // case 3 (location) is rendered full-screen outside the ScrollView — see below.

      case 4:
        // Rendered straight into the scroll content so its pin maths start at 0.
        return (
          <StackedPhotos
            images={photos}
            width={PHOTO_CONTENT_WIDTH}
            scrollY={scrollY}
            parentOffsetY={0}
            uploading={uploading}
            uploadProgress={uploadProgress}
            onReplace={replacePhoto}
            onRemove={removePhoto}
            onAdd={() => pickAndUpload()}
            showAddButton={false}
          />
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
            <View style={{ flex: 1 }}>
              <AddressMapPicker
                key={`onboarding-map-${mapRevision}`}
                initialAddress={address}
                initialLat={latitude}
                initialLng={longitude}
                showSearch={false}
                showResolvedAddress={false}
                markerVariant="location"
                markerIcon="home"
                markerLabel={address || salonName}
                markerSubtitle="Your salon is here"
                onChange={({ address: addr, latitude: lat, longitude: lng }) => {
                  setAddress(addr);
                  setLatitude(lat);
                  setLongitude(lng);
                  setError('');
                }}
              />
              <TouchableOpacity
                activeOpacity={0.82}
                accessibilityLabel="Use my current location"
                onPress={locateMe}
                disabled={locating}
                style={mapRecenterButton}
              >
                {locating
                  ? <ActivityIndicator color={darkBrown} />
                  : <Ionicons name="navigate" size={24} color={darkBrown} />}
              </TouchableOpacity>
            </View>

            <View style={locationSheet}>
              <View style={locationSheetHandle} />
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 26, color: darkBrown, lineHeight: 32 }}>
                {q.question}
              </Text>
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: '#6F6258', lineHeight: 20, marginTop: 4, marginBottom: 16 }}>
                Drag the map to put the pin on your door
              </Text>

              <View style={locationSearchBar}>
                <Ionicons name="search" size={20} color="#9A8E83" />
                <TextInput
                  value={locationQuery}
                  onChangeText={setLocationQuery}
                  placeholder="Search street, city, district…"
                  placeholderTextColor="#9A8E83"
                  returnKeyType="search"
                  onSubmitEditing={runLocationSearch}
                  style={{ flex: 1, fontFamily: 'Philosopher-Regular', fontSize: 16, color: darkBrown, paddingVertical: 0 }}
                />
                {searchingLocation ? <ActivityIndicator size="small" color={darkBrown} /> : null}
              </View>

              {error ? (
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: red, marginTop: 10 }}>
                  {error}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <Animated.ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 48, paddingBottom: 24 }}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
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
          </Animated.ScrollView>
        )}

        {/* Continue / Finish button — on the photos step, Add photo is pinned above it. */}
        <View style={{
          paddingHorizontal: 28, paddingBottom: insets.bottom + 16, paddingTop: 8,
          backgroundColor: step === 3 ? lightBeige : white,
          ...(step === 4 && { paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(66,49,32,0.08)' }),
        }}>
          {step === 4 && photos.length < MAX_PHOTOS && (
            <AddPhotoButton
              isFirst={photos.length === 0}
              uploading={uploading === 'new'}
              disabled={uploading !== null || submitting}
              uploadProgress={uploadProgress}
              onPress={() => pickAndUpload()}
            />
          )}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={goNext}
            disabled={submitting || uploading !== null}
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

// ─── Styles (map + photos follow the provider salon screen) ───────────────────

const mapRecenterButton = {
  position: 'absolute' as const,
  right: 16,
  bottom: 42,
  width: 48,
  height: 48,
  borderRadius: 24,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: lightBeige,
  borderWidth: 1,
  borderColor: '#E5E5E5',
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.14,
  shadowRadius: 8,
  elevation: 5,
};

const locationSheet = {
  marginTop: -24,
  paddingTop: 10,
  paddingHorizontal: 28,
  paddingBottom: 8,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  backgroundColor: lightBeige,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.1,
  shadowRadius: 14,
  elevation: 12,
};

const locationSheetHandle = {
  width: 48,
  height: 5,
  borderRadius: 3,
  alignSelf: 'center' as const,
  marginBottom: 16,
  backgroundColor: beige,
};

const locationSearchBar = {
  minHeight: 52,
  borderRadius: 26,
  paddingHorizontal: 18,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 10,
  backgroundColor: '#EDE3D8',
};








