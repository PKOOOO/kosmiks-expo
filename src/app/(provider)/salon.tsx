import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Switch, Modal,
  KeyboardAvoidingView, Platform, Image, Dimensions, StyleSheet, StatusBar, Animated,
} from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import useProviderServicesStore from '@/store/provider-services.store';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { API_BASE_URL } from '@/config/constants';
import { uploadImage } from '@/lib/upload-image';
import AddressMapPicker from '@/components/AddressMapPicker';
import { pickSalonPhoto, prepareForUpload } from '@/lib/pick-photo';
import StackedPhotos, { AddPhotoButton, MAX_PHOTOS } from '@/components/StackedPhotos';
import BrandHeader from '@/components/BrandHeader';
import { reverseGeocode, searchAddresses } from '@/lib/geocode';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const pageBg = '#EDE3D8';
const white = '#FFFFFF';

const canUseNativeLiquidGlass = () => {
  if (Platform.OS !== 'ios') return false;
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
};

const SCREEN_W = Dimensions.get('window').width;
// Photos sit straight on the page: full width minus the scroll padding (16×2).
const PHOTO_CONTENT_WIDTH = SCREEN_W - 32;

const BUILDING_TYPES = [
  { label: 'House', icon: 'home-outline' },
  { label: 'Apartment', icon: 'business-outline' },
  { label: 'Office', icon: 'desktop-outline' },
  { label: 'Other', icon: 'storefront-outline' },
] as const;
type BuildingType = (typeof BUILDING_TYPES)[number]['label'];
type AddressLabel = 'home' | 'custom';

type SalonForm = { name: string; description: string; shortIntro: string; address: string };
type SalonCoordinates = { latitude: number | null; longitude: number | null };
type LocationChoice = { address: string; latitude: number | null; longitude: number | null };

const compactAddress = (address: string) => {
  const parts = address.split(',').map(part => part.trim()).filter(Boolean);
  return parts.length > 2 ? parts.slice(-2).join(', ') : address;
};

const coordinateAddressPattern = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/;

const locationFallback = (address: string, city?: string) => {
  if (address && !coordinateAddressPattern.test(address.trim())) return compactAddress(address);
  return city ? `${city}, Finland` : compactAddress(address);
};

const searchResultCopy = (address: string) => {
  const parts = address.split(',').map(part => part.trim()).filter(Boolean);
  return {
    title: parts[0] || address,
    subtitle: parts.length > 1 ? parts.slice(-2).join(', ') : address,
  };
};

const addressDetailsCopy = (address: string) => {
  const parts = address.split(',').map(part => part.trim()).filter(Boolean);
  const possibleCode = parts.at(-3) ?? '';
  const hasPostalOrPlusCode = /^(?=.*\d)[a-z\d][a-z\d+ -]{2,11}$/i.test(possibleCode);
  return {
    title: parts.length >= 3
      ? parts.slice(hasPostalOrPlusCode ? -3 : -2).join(', ')
      : address,
    subtitle: parts.length >= 2 ? parts.slice(-2).join(', ') : address,
  };
};

const resolveLocationLabel = async (
  latitude: unknown,
  longitude: unknown,
  address: string,
  fallbackCity?: string,
) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return locationFallback(address, fallbackCity);
  }

  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const city = place?.city || place?.district || place?.subregion || place?.region;
    const country = place?.country;
    const label = [city, country].filter(Boolean).join(', ');
    return label || locationFallback(address, fallbackCity);
  } catch {
    return locationFallback(address, fallbackCity);
  }
};

const resolveFullAddress = async (latitude: number, longitude: number) => {
  return reverseGeocode(latitude, longitude);
};

export default function ProviderSalonScreen() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const navigation = useNavigation();
  const router = useRouter();
  const setTabBarHidden = useProviderServicesStore(state => state.setTabBarHidden);

  // This screen has its own Add photo button at the bottom, so the tab bar
  // stays hidden while it's open; the back button returns to Services.
  useFocusEffect(useCallback(() => {
    setTabBarHidden(true);
    return () => setTabBarHidden(false);
  }, [setTabBarHidden]));
  const insets = useSafeAreaInsets();
  const nativeLiquidGlass = canUseNativeLiquidGlass();

  const [saloonId, setSaloonId] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [savedImages, setSavedImages] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState<number | 'new' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Drives the stacked-photos scroll effect.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [photosCardY, setPhotosCardY] = useState(0);
  const [form, setForm] = useState<SalonForm>({ name: '', description: '', shortIntro: '', address: '' });
  const [savedForm, setSavedForm] = useState<SalonForm>({ name: '', description: '', shortIntro: '', address: '' });
  const [locationLabel, setLocationLabel] = useState('');
  const [providerCity, setProviderCity] = useState('');
  const [coordinates, setCoordinates] = useState<SalonCoordinates>({ latitude: null, longitude: null });
  const [savedCoordinates, setSavedCoordinates] = useState<SalonCoordinates>({ latitude: null, longitude: null });
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationModalMode, setLocationModalMode] = useState<'list' | 'edit' | 'search' | 'building' | 'details'>('list');
  const [mapRevision, setMapRevision] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<LocationChoice[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationChoice | null>(null);
  const [draftLocation, setDraftLocation] = useState<LocationChoice>({ address: '', latitude: null, longitude: null });
  const [selectedBuildingType, setSelectedBuildingType] = useState<BuildingType>('House');
  const [floorNumber, setFloorNumber] = useState('');
  const [doorNumber, setDoorNumber] = useState('');
  const [additionalLocationInfo, setAdditionalLocationInfo] = useState('');
  const [addressLabel, setAddressLabel] = useState<AddressLabel>('home');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const failedSaveRef = useRef<string | null>(null);

  const hasFormChanges = JSON.stringify(form) !== JSON.stringify(savedForm);
  const hasImageChanges = JSON.stringify(images) !== JSON.stringify(savedImages);
  const hasLocationChanges = JSON.stringify(coordinates) !== JSON.stringify(savedCoordinates);
  const hasChanges = hasFormChanges || hasImageChanges || hasLocationChanges;
  const selectedBuilding = BUILDING_TYPES.find(item => item.label === selectedBuildingType) ?? BUILDING_TYPES[0];
  const detailsAddress = addressDetailsCopy(draftLocation.address);

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

      const [detailRes, statusRes] = await Promise.all([
        fetch(`${API_BASE_URL}/saloons/${id}`, { headers }),
        fetch(`${API_BASE_URL}/provider/apply/status`, { headers }),
      ]);

      const statusPayload = statusRes.ok ? await statusRes.json() : null;
      const applicationCity = typeof statusPayload?.application?.city === 'string'
        ? statusPayload.application.city.trim()
        : '';
      setProviderCity(applicationCity);

      if (detailRes.ok) {
        const salon = await detailRes.json();
        const f: SalonForm = {
          name: salon.name ?? '', description: salon.description ?? '',
          shortIntro: salon.shortIntro ?? '', address: salon.address ?? '',
        };
        setForm(f); setSavedForm(f);
        const salonCoordinates = {
          latitude: typeof salon.latitude === 'number' ? salon.latitude : null,
          longitude: typeof salon.longitude === 'number' ? salon.longitude : null,
        };
        setCoordinates(salonCoordinates);
        setSavedCoordinates(salonCoordinates);
        setLocationLabel(locationFallback(f.address, applicationCity));
        void resolveLocationLabel(salon.latitude, salon.longitude, f.address, applicationCity)
          .then(setLocationLabel);
        if (Array.isArray(salon.images)) {
          const urls = salon.images.map((img: { url: string }) => img.url);
          setImages(urls); setSavedImages(urls);
        }
      }

    } catch { setError('Failed to load salon info.'); }
    finally { setLoading(false); }
  }, [authHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Every change saves itself — there is no save button.
  const handleSave = async () => {
    if (!saloonId || !form.name.trim()) return;
    failedSaveRef.current = null;
    setSaving(true); setError(null); setSuccessMsg(null);
    const attempt = JSON.stringify({ form, images, coordinates });
    try {
      const headers = await authHeaders();
      if (hasFormChanges || hasImageChanges || hasLocationChanges) {
        const res = await fetch(`${API_BASE_URL}/saloons/${saloonId}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
            shortIntro: form.shortIntro.trim() || null,
            address: form.address.trim() || null,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            ...(hasImageChanges && { images: images.map(url => ({ url })) }),
          }),
        });
        if (!res.ok) throw new Error('Failed to save salon info');
        setSavedForm({ ...form });
        setSavedCoordinates({ ...coordinates });
        if (hasImageChanges) setSavedImages([...images]);
      }
      setSuccessMsg('Saved');
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (e: any) {
      // Don't auto-retry the same failing change in a loop; the banner offers a retry.
      failedSaveRef.current = attempt;
      setError(e?.message || "Couldn't save your changes.");
    } finally { setSaving(false); }
  };
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  // Save shortly after the last change, so quick edits go out as one request.
  useEffect(() => {
    if (!hasChanges || saving || uploadingPhoto !== null) return;
    if (failedSaveRef.current === JSON.stringify({ form, images, coordinates })) return;
    const t = setTimeout(() => { void handleSaveRef.current(); }, 600);
    return () => clearTimeout(t);
  }, [hasChanges, saving, uploadingPhoto, form, images, coordinates]);

  // Leaving the tab with an edit still waiting for its timer: save it right away.
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      if (hasChanges && !saving) void handleSaveRef.current();
    });
    return unsubscribe;
  }, [navigation, hasChanges, saving]);

  const pickAndUpload = async (replaceIndex?: number) => {
    if (replaceIndex == null && images.length >= 6) {
      Alert.alert('Limit reached', 'Maximum 6 photos allowed.');
      return;
    }
    const asset = await pickSalonPhoto();
    if (!asset) return;
    setUploadProgress(0);
    setUploadingPhoto(replaceIndex ?? 'new');
    try {
      const photoUri = await prepareForUpload(asset);
      const token = await getTokenRef.current();
      const { url } = await uploadImage({
        uri: photoUri,
        authorization: `Bearer ${token ?? ''}`,
        userToken: token ?? undefined,
        onProgress: setUploadProgress,
      });
      setImages(prev => replaceIndex == null
        ? [...prev, url]
        : prev.map((currentUrl, index) => index === replaceIndex ? url : currentUrl));
    } catch { Alert.alert('Upload failed', 'Please try again.'); }
    finally { setUploadingPhoto(null); }
  };

  const removeImage = (index: number) => {
    Alert.alert('Remove photo?', 'It will be removed from your salon.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setImages(prev => prev.filter((_, i) => i !== index)) },
    ]);
  };

  const openLocationModal = () => {
    const savedLocation = {
      address: form.address,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };
    setDraftLocation(savedLocation);
    setLocationModalMode('list');
    setLocationSearch('');
    setLocationSearchResults([]);
    setSelectedBuildingType('House');
    setFloorNumber('');
    setDoorNumber('');
    setAdditionalLocationInfo('');
    setAddressLabel('home');
    setLocationModalVisible(true);
    setLocating(true);

    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: await resolveFullAddress(position.coords.latitude, position.coords.longitude),
        };
        setCurrentLocation(next);
        setDraftLocation(next);
        setMapRevision(revision => revision + 1);
      } catch {
        setCurrentLocation(null);
      } finally {
        setLocating(false);
      }
    })();
  };

  const applyLocation = (nextLocation: LocationChoice) => {
    if (nextLocation.latitude == null || nextLocation.longitude == null) return;
    setForm(current => ({ ...current, address: nextLocation.address }));
    setCoordinates({ latitude: nextLocation.latitude, longitude: nextLocation.longitude });
    setLocationLabel(locationFallback(nextLocation.address, providerCity));
    void resolveLocationLabel(
      nextLocation.latitude,
      nextLocation.longitude,
      nextLocation.address,
      providerCity,
    ).then(setLocationLabel);
    setLocationModalVisible(false);
  };

  const beginLocationEdit = (nextLocation: LocationChoice) => {
    setDraftLocation(nextLocation);
    setLocationModalMode('edit');
    setLocationSearch('');
    setMapRevision(revision => revision + 1);
  };

  const openLocationSearch = () => {
    const suggestions = [
      currentLocation,
      coordinates.latitude != null && coordinates.longitude != null
        ? { address: form.address, latitude: coordinates.latitude, longitude: coordinates.longitude }
        : null,
    ].filter((item): item is LocationChoice => Boolean(item?.address));

    setLocationSearch('');
    setLocationSearchResults(suggestions.filter((item, index, items) => (
      items.findIndex(candidate => candidate.address === item.address) === index
    )));
    setLocationModalMode('search');
  };

  const selectSearchResult = (nextLocation: LocationChoice) => {
    setDraftLocation(nextLocation);
    setLocationModalMode('edit');
    setMapRevision(revision => revision + 1);
  };

  const openAddressDetails = (buildingType: BuildingType) => {
    setSelectedBuildingType(buildingType);
    setLocationModalMode('details');
  };

  const searchForLocation = async () => {
    const query = locationSearch.trim();
    if (!query) return;
    setSearchingLocation(true);
    try {
      const nextLocations = await searchAddresses(query, {
        near: coordinates.latitude != null && coordinates.longitude != null
          ? { latitude: coordinates.latitude, longitude: coordinates.longitude }
          : null,
      });
      const uniqueLocations = nextLocations.filter((item, index, items) => (
        items.findIndex(candidate => candidate.address === item.address) === index
      ));
      if (uniqueLocations.length === 0) {
        Alert.alert('Location not found', 'Try a more specific street, city, or district.');
        return;
      }
      setLocationSearchResults(uniqueLocations);
    } catch {
      Alert.alert('Location not found', 'Try a more specific street, city, or district.');
    } finally {
      setSearchingLocation(false);
    }
  };

  const navigateBackFromLocationModal = () => {
    if (locationModalMode === 'search') {
      setLocationModalMode('edit');
    } else if (locationModalMode === 'details') {
      setLocationModalMode('building');
    } else if (locationModalMode === 'building') {
      setLocationModalMode('edit');
    } else if (locationModalMode === 'edit') {
      setLocationModalMode('list');
      setMapRevision(revision => revision + 1);
    } else {
      setLocationModalVisible(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView
        edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined}
        style={{ flex: 1, backgroundColor: pageBg, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color={darkBrown} />
      </SafeAreaView>
    );
  }

  if (!saloonId) {
    return (
      <SafeAreaView
        edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined}
        style={{ flex: 1, backgroundColor: pageBg, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}
      >
        <Ionicons name="storefront-outline" size={52} color={beige} style={{ marginBottom: 14 }} />
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 17, color: darkBrown, textAlign: 'center' }}>No salon found</Text>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: '#888', textAlign: 'center', marginTop: 6 }}>
          Complete your onboarding to set up your salon profile.
        </Text>
      </SafeAreaView>
    );
  }

  // Room for the sticky Add photo footer.
  const scrollBottomPadding = 24;

  return (
    <SafeAreaView
      edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined}
      style={{ flex: 1, backgroundColor: pageBg }}
    >

      <BrandHeader />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={{
        alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 0, paddingBottom: 12,
        backgroundColor: pageBg,
      }}>
        <View style={headerRow}>
        <View style={Platform.OS === 'ios' ? backGlassShadow : undefined}>
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Back to services"
            onPress={() => router.navigate('/(provider)/services' as any)}
          >
            {/* Same Liquid Glass treatment as the location pill on iOS. */}
            {nativeLiquidGlass ? (
              <GlassView
                glassEffectStyle="clear"
                colorScheme="light"
                tintColor="rgba(244,237,229,0.14)"
                isInteractive
                style={[headerBackButton, backNativeGlass]}
              >
                <Ionicons name="arrow-back" size={22} color={darkBrown} />
              </GlassView>
            ) : Platform.OS === 'ios' ? (
              <View style={[headerBackButton, backBlurGlass]}>
                <BlurView intensity={68} tint="light" style={StyleSheet.absoluteFill} />
                <View pointerEvents="none" style={locationGlassTint} />
                <Ionicons name="arrow-back" size={22} color={darkBrown} />
              </View>
            ) : (
              <View style={[headerBackButton, backAndroid]}>
                <Ionicons name="arrow-back" size={22} color={darkBrown} />
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={[Platform.OS === 'ios' ? locationGlassShadow : locationAndroidShadow, { flex: 1, width: undefined }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={openLocationModal}
            accessibilityRole="button"
            accessibilityLabel={`Salon location: ${locationLabel || form.address.trim() || 'Add salon address'}`}
            style={locationPillTouchTarget}
          >
            {nativeLiquidGlass ? (
              <GlassView
                glassEffectStyle="clear"
                colorScheme="light"
                tintColor="rgba(244,237,229,0.14)"
                isInteractive
                style={[locationPill, locationNativeGlass]}
              >
                <LocationPillContents label={locationLabel || form.address.trim() || 'Add salon address'} />
              </GlassView>
            ) : (
              <View style={locationPill}>
                {Platform.OS === 'ios' && (
                  <>
                    <BlurView intensity={68} tint="light" style={StyleSheet.absoluteFill} />
                    <View pointerEvents="none" style={locationGlassTint} />
                    <View pointerEvents="none" style={locationGlassHighlight} />
                  </>
                )}
                <LocationPillContents label={locationLabel || form.address.trim() || 'Add salon address'} />
              </View>
            )}
          </TouchableOpacity>
        </View>
        </View>
        {(saving || hasChanges || successMsg) && !error && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            {saving || hasChanges
              ? <ActivityIndicator size="small" color="#8A7F75" style={{ transform: [{ scale: 0.7 }] }} />
              : <Ionicons name="checkmark-circle" size={14} color="#2d7a2d" />}
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: saving || hasChanges ? '#8A7F75' : '#2d7a2d' }}>
              {saving || hasChanges ? 'Saving…' : 'Saved'}
            </Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: scrollBottomPadding }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        >

          {/* ── Banners ──────────────────────────────────────────────────── */}
          {error && (
            <View style={[banner, { backgroundColor: '#fff0f0', borderColor: '#ffb3b3', marginBottom: 12 }]}>
              <Ionicons name="alert-circle-outline" size={16} color="#c00" />
              <Text style={{ fontFamily: 'Philosopher-Regular', color: '#c00', fontSize: 14, flex: 1 }}>{error}</Text>
              {hasChanges && (
                <TouchableOpacity onPress={() => void handleSave()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontFamily: 'Philosopher-Bold', color: '#c00', fontSize: 14 }}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ══════════════════════════════════════
              CARD: Basic Info
          ══════════════════════════════════════ */}


          {/* ══════════════════════════════════════
              CARD: Photos
          ══════════════════════════════════════ */}
          <View onLayout={e => setPhotosCardY(e.nativeEvent.layout.y)}>
            <StackedPhotos
              images={images}
              width={PHOTO_CONTENT_WIDTH}
              scrollY={scrollY}
              parentOffsetY={photosCardY}
              uploading={uploadingPhoto}
              uploadProgress={uploadProgress}
              onReplace={index => pickAndUpload(index)}
              onRemove={removeImage}
              onAdd={() => pickAndUpload()}
              showAddButton={false}
            />

            {images.length === 0 && (
              <Text style={photoEmptyText}>
                Add a bright, clear photo that shows customers your salon.
              </Text>
            )}
          </View>

        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Add photo footer — the tab bar is hidden on this screen. */}
      {images.length < MAX_PHOTOS && (
        <View style={[addPhotoFooter, { paddingBottom: insets.bottom + 12 }]}>
          <AddPhotoButton
            isFirst={images.length === 0}
            uploading={uploadingPhoto === 'new'}
            disabled={uploadingPhoto !== null}
            uploadProgress={uploadProgress}
            onPress={() => pickAndUpload()}
            filled
          />
        </View>
      )}

      {locationModalVisible && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="overFullScreen"
          statusBarTranslucent
          navigationBarTranslucent={Platform.OS === 'android'}
          onRequestClose={navigateBackFromLocationModal}
        >
          <StatusBar barStyle="dark-content" />
          {locationModalMode === 'search' ? (
            <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={locationSearchPage}>
              <View style={locationSearchHeader}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Back to the map"
                  onPress={navigateBackFromLocationModal}
                  style={locationSearchBackButton}
                >
                  <Ionicons name="arrow-back" size={27} color={darkBrown} />
                </TouchableOpacity>

                <View style={locationSearchPageBar}>
                  <Ionicons name="search" size={26} color={darkBrown} />
                  <TextInput
                    autoFocus
                    value={locationSearch}
                    onChangeText={value => {
                      setLocationSearch(value);
                      if (!value.trim()) setLocationSearchResults([]);
                    }}
                    onSubmitEditing={searchForLocation}
                    returnKeyType="search"
                    placeholder="Enter street, building number…"
                    placeholderTextColor="#8D8176"
                    style={locationSearchPageInput}
                  />
                  {searchingLocation && <ActivityIndicator size="small" color={darkBrown} />}
                </View>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={locationSearchResultsContent}
                keyboardShouldPersistTaps="handled"
              >
                {locationSearchResults.map((result, index) => {
                  const copy = searchResultCopy(result.address);
                  return (
                    <TouchableOpacity
                      key={`${result.latitude}-${result.longitude}-${index}`}
                      activeOpacity={0.7}
                      onPress={() => selectSearchResult(result)}
                      style={locationSearchResultRow}
                    >
                      <Ionicons name="location-outline" size={28} color={darkBrown} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={locationSearchResultTitle}>{copy.title}</Text>
                        <Text numberOfLines={1} style={locationSearchResultSubtitle}>{copy.subtitle}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </SafeAreaView>
          ) : locationModalMode === 'details' ? (
            <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={addressDetailsPage}>
              <View style={addressDetailsHeader}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Back to building types"
                  onPress={navigateBackFromLocationModal}
                  style={addressDetailsBackButton}
                >
                  <Ionicons name="arrow-back" size={27} color={darkBrown} />
                </TouchableOpacity>
                <Text style={addressDetailsHeaderTitle}>Address details</Text>
                <View style={{ width: 48 }} />
              </View>

              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
              >
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={addressDetailsContent}
                >
                  <View style={addressDetailsLocationRow}>
                    <Ionicons name={selectedBuilding.icon} size={29} color={darkBrown} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={addressDetailsAddressTitle}>
                        {detailsAddress.title || 'Selected salon location'}
                      </Text>
                      <Text numberOfLines={1} style={addressDetailsAddressSubtitle}>
                        {detailsAddress.subtitle || 'Location selected on the map'}
                      </Text>
                    </View>
                  </View>

                  <View style={addressDetailsTwoColumns}>
                    <View style={addressDetailsFieldColumn}>
                      <Text style={addressDetailsFieldLabel}>Floor number</Text>
                      <TextInput
                        value={floorNumber}
                        onChangeText={setFloorNumber}
                        style={addressDetailsSmallInput}
                        returnKeyType="next"
                      />
                    </View>
                    <View style={addressDetailsFieldColumn}>
                      <Text style={addressDetailsFieldLabel}>Door number</Text>
                      <TextInput
                        value={doorNumber}
                        onChangeText={setDoorNumber}
                        style={addressDetailsSmallInput}
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  <Text style={addressDetailsFieldLabel}>Additional information</Text>
                  <TextInput
                    value={additionalLocationInfo}
                    onChangeText={setAdditionalLocationInfo}
                    multiline
                    textAlignVertical="top"
                    style={addressDetailsLargeInput}
                  />

                  <Text style={addressDetailsSectionTitle}>Mark your entrance</Text>
                  <Text style={addressDetailsSectionSubtitle}>Help customers find your salon faster</Text>
                  <View style={addressDetailsMapCard}>
                    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                      <AddressMapPicker
                        key={`address-details-map-${mapRevision}`}
                        initialAddress={draftLocation.address}
                        initialLat={draftLocation.latitude}
                        initialLng={draftLocation.longitude}
                        onChange={() => undefined}
                        showSearch={false}
                        showResolvedAddress={false}
                        markerVariant="location"
                        markerIcon="home"
                        showMarkerLabel={false}
                      />
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setLocationModalMode('edit');
                        setMapRevision(revision => revision + 1);
                      }}
                      style={addressDetailsAdjustPin}
                    >
                      <Text style={addressDetailsAdjustPinText}>Adjust pin</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                <View style={addressDetailsStickyFooter}>
                  <TouchableOpacity
                    activeOpacity={0.84}
                    disabled={draftLocation.latitude == null || draftLocation.longitude == null}
                    onPress={() => applyLocation(draftLocation)}
                    style={[
                      addressDetailsSaveButton,
                      (draftLocation.latitude == null || draftLocation.longitude == null) && { opacity: 0.45 },
                    ]}
                  >
                    <Text style={addressDetailsSaveButtonText}>Save address</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </SafeAreaView>
          ) : (
            <SafeAreaView
              edges={['left', 'right', 'bottom']}
              style={{ flex: 1, backgroundColor: lightBeige }}
            >
            <View style={{ flex: 1, minHeight: 340 }}>
              <AddressMapPicker
                key={`salon-map-${mapRevision}`}
                initialAddress={draftLocation.address}
                initialLat={draftLocation.latitude}
                initialLng={draftLocation.longitude}
                searchLeft={76}
                showSearch={false}
                showResolvedAddress={false}
                markerVariant="location"
                markerLabel={draftLocation.address || 'Current location'}
                markerSubtitle={locationModalMode === 'building' ? "We'll deliver here" : 'Use this point'}
                markerIcon={locationModalMode === 'list' ? 'globe' : 'home'}
                onMarkerPress={() => {
                  if (draftLocation.latitude != null && draftLocation.longitude != null) {
                    setLocationModalMode('building');
                    setMapRevision(revision => revision + 1);
                  }
                }}
                onPinDrop={() => setLocationModalMode('edit')}
                onChange={nextLocation => setDraftLocation(nextLocation)}
              />

              <TouchableOpacity
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={locationModalMode === 'list' ? 'Close location map' : 'Go back'}
                onPress={navigateBackFromLocationModal}
                style={[
                  mapCloseButton,
                  { top: insets.top + (Platform.OS === 'ios' ? 20 : 14) },
                ]}
              >
                <Ionicons
                  name={locationModalMode === 'list' ? 'close' : 'arrow-back'}
                  size={28}
                  color={darkBrown}
                />
              </TouchableOpacity>

              {currentLocation && (
                <TouchableOpacity
                  activeOpacity={0.82}
                  accessibilityLabel="Recenter on current location"
                  onPress={() => {
                    setDraftLocation(currentLocation);
                    setMapRevision(revision => revision + 1);
                  }}
                  style={mapRecenterButton}
                >
                  <Ionicons name="navigate" size={25} color={darkBrown} />
                </TouchableOpacity>
              )}
            </View>

            <View style={[
              locationSheet,
              locationModalMode === 'edit' && locationSearchSheet,
              locationModalMode === 'building' && locationBuildingSheet,
            ]}>
              <View style={locationSheetHandle} />
              {locationModalMode !== 'edit' && (
                <Text style={locationSheetTitle}>
                  {locationModalMode === 'list' ? 'Where is your salon?' : 'Choose your building'}
                </Text>
              )}

              {locationModalMode === 'list' ? (
                <>
                  <View style={locationOptionRow}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      disabled={!currentLocation}
                      onPress={() => currentLocation && applyLocation(currentLocation)}
                      style={locationOptionMain}
                    >
                      <Ionicons name="navigate-outline" size={27} color={darkBrown} />
                      <View style={{ flex: 1 }}>
                        <Text style={locationOptionTitle}>Current location</Text>
                        <Text numberOfLines={2} style={locationOptionAddress}>
                          {locating
                            ? 'Finding your current location…'
                            : currentLocation?.address || 'Current location unavailable'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      disabled={!currentLocation}
                      onPress={() => currentLocation && beginLocationEdit(currentLocation)}
                      style={[locationEditIcon, !currentLocation && { opacity: 0.4 }]}
                    >
                      <Ionicons name="create-outline" size={25} color={darkBrown} />
                    </TouchableOpacity>
                  </View>

                  <View style={locationOptionRow}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => applyLocation({
                        address: form.address,
                        latitude: coordinates.latitude,
                        longitude: coordinates.longitude,
                      })}
                      style={locationOptionMain}
                    >
                      <Ionicons name="storefront-outline" size={27} color={darkBrown} />
                      <View style={{ flex: 1 }}>
                        <Text style={locationOptionTitle}>{form.name || 'Salon address'}</Text>
                        <Text numberOfLines={2} style={locationOptionAddress}>
                          {form.address || 'No salon address saved'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => beginLocationEdit({
                        address: form.address,
                        latitude: coordinates.latitude,
                        longitude: coordinates.longitude,
                      })}
                      style={locationEditIcon}
                    >
                      <Ionicons name="create-outline" size={25} color={darkBrown} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => beginLocationEdit(currentLocation || {
                      address: form.address,
                      latitude: coordinates.latitude,
                      longitude: coordinates.longitude,
                    })}
                    style={locationAddButton}
                  >
                    <Text style={locationAddButtonText}>Add a new address</Text>
                  </TouchableOpacity>
                </>
              ) : locationModalMode === 'edit' ? (
                <>
                  <Text style={locationSearchPrompt}>
                    Trouble locating your address?{`\n`}Try using search instead
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityLabel="Search for an address"
                    onPress={openLocationSearch}
                    style={locationSearchBar}
                  >
                    <Ionicons name="search" size={21} color="#9A8E83" />
                    <Text style={locationSearchPlaceholder}>Search street, city, district…</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={locationBuildingSubtitle}>
                    This helps customers know exactly where to find your salon.
                  </Text>
                  <View style={locationBuildingGrid}>
                    {BUILDING_TYPES.map(building => (
                      <TouchableOpacity
                        key={building.label}
                        activeOpacity={0.78}
                        onPress={() => openAddressDetails(building.label)}
                        style={locationBuildingCard}
                      >
                        <Ionicons name={building.icon} size={28} color={darkBrown} />
                        <Text style={locationBuildingLabel}>{building.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
            </SafeAreaView>
          )}
        </Modal>
      )}

    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LocationPillContents({ label }: { label: string }) {
  return (
    <>
      <Ionicons name="location-outline" size={20} color={darkBrown} />
      <Text numberOfLines={1} style={locationText}>{label}</Text>
      <Ionicons name="chevron-down" size={19} color={darkBrown} />
    </>
  );
}


const cardHeaderText = {
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 12,
  color: '#423120',
  textTransform: 'uppercase' as const,
  letterSpacing: 0.9,
};
























const photoEmptyText = {
  color: '#8D8176',
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 12,
  lineHeight: 17,
  textAlign: 'center' as const,
  marginTop: 10,
  paddingHorizontal: 18,
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

const locationGlassShadow = {
  width: '88%' as const,
  maxWidth: 360,
  borderRadius: 28,
  shadowColor: '#423120',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.14,
  shadowRadius: 16,
};

const locationAndroidShadow = {
  width: '88%' as const,
  maxWidth: 360,
  borderRadius: 28,
  elevation: 3,
  shadowColor: '#423120',
};

const locationPillTouchTarget = {
  width: '100%' as const,
  borderRadius: 28,
  overflow: 'hidden' as const,
};

const locationPill = {
  minHeight: 52,
  borderRadius: 28,
  borderWidth: 1,
  borderColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.78)' : '#C7AD8B',
  backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.20)' : '#D7C3A7',
  paddingHorizontal: 17,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 10,
  overflow: 'hidden' as const,
};

const locationNativeGlass = {
  backgroundColor: 'transparent',
  borderColor: 'rgba(255,255,255,0.72)',
};

const locationGlassTint = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: 'rgba(255,255,255,0.18)',
};

const locationGlassHighlight = {
  position: 'absolute' as const,
  top: 1,
  left: 20,
  right: 20,
  height: 1,
  backgroundColor: 'rgba(255,255,255,0.86)',
};

const locationText = {
  flex: 1,
  color: '#423120',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 16,
};

const mapCloseButton = {
  position: 'absolute' as const,
  left: 16,
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: '#F4EDE5',
  borderWidth: 1,
  borderColor: 'rgba(66,49,32,0.16)',
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.14,
  shadowRadius: 8,
  elevation: 5,
};

const mapRecenterButton = {
  position: 'absolute' as const,
  right: 16,
  bottom: 42,
  width: 48,
  height: 48,
  borderRadius: 24,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: '#F4EDE5',
  borderWidth: 1,
  borderColor: '#E5E5E5',
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.14,
  shadowRadius: 8,
  elevation: 5,
};

const locationSheet = {
  minHeight: 334,
  marginTop: -24,
  paddingTop: 12,
  paddingHorizontal: 28,
  paddingBottom: 22,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  backgroundColor: '#F4EDE5',
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.1,
  shadowRadius: 14,
  elevation: 12,
};

const locationSearchSheet = {
  minHeight: 174,
  paddingTop: 10,
};

const locationBuildingSheet = {
  minHeight: 388,
};

const locationSheetHandle = {
  width: 48,
  height: 5,
  borderRadius: 3,
  alignSelf: 'center' as const,
  marginBottom: 18,
  backgroundColor: '#D7C3A7',
};

const locationSheetTitle = {
  color: '#423120',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 30,
  lineHeight: 37,
  marginBottom: 24,
};

const locationOptionRow = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 14,
  marginBottom: 22,
};

const locationOptionMain = {
  flex: 1,
  minHeight: 56,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 16,
};

const locationOptionTitle = {
  color: '#423120',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 17,
  lineHeight: 21,
};

const locationOptionAddress = {
  color: '#6F6258',
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 15,
  lineHeight: 20,
  marginTop: 3,
};

const locationEditIcon = {
  width: 48,
  height: 48,
  borderRadius: 24,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: '#EDE3D8',
};

const locationSearchPrompt = {
  color: '#423120',
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 16,
  lineHeight: 21,
  textAlign: 'center' as const,
  marginBottom: 18,
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

const locationSearchPlaceholder = {
  flex: 1,
  color: '#9A8E83',
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 16,
};

const locationSearchPage = {
  flex: 1,
  backgroundColor: '#F4EDE5',
};

const locationSearchHeader = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 12,
  paddingHorizontal: 18,
  paddingTop: 12,
  paddingBottom: 20,
};

const locationSearchBackButton = {
  width: 48,
  height: 48,
  borderRadius: 24,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  borderWidth: 1,
  borderColor: '#D7C3A7',
  backgroundColor: '#F8F4EF',
};

const locationSearchPageBar = {
  flex: 1,
  minHeight: 52,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 10,
  paddingHorizontal: 16,
  borderRadius: 27,
  borderWidth: 1,
  borderColor: '#D7C3A7',
  backgroundColor: '#F8F4EF',
};

const locationSearchPageInput = {
  flex: 1,
  color: '#423120',
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 17,
  paddingVertical: 10,
};

const locationSearchResultsContent = {
  paddingHorizontal: 30,
  paddingTop: 36,
  paddingBottom: 40,
  gap: 30,
};

const locationSearchResultRow = {
  minHeight: 64,
  flexDirection: 'row' as const,
  alignItems: 'flex-start' as const,
  gap: 18,
};

const locationSearchResultTitle = {
  color: '#423120',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 18,
  lineHeight: 23,
};

const locationSearchResultSubtitle = {
  color: '#6F6258',
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 16,
  lineHeight: 21,
  marginTop: 4,
};

const addressDetailsPage = {
  flex: 1,
  backgroundColor: '#F4EDE5',
};

const addressDetailsHeader = {
  minHeight: 78,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
  paddingHorizontal: 18,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: 'rgba(66,49,32,0.14)',
};

const addressDetailsBackButton = {
  width: 48,
  height: 48,
  borderRadius: 24,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  borderWidth: 1,
  borderColor: '#D7C3A7',
  backgroundColor: '#F8F4EF',
};

const addressDetailsHeaderTitle = {
  color: '#423120',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 22,
};

const addressDetailsContent = {
  paddingHorizontal: 24,
  paddingTop: 28,
  paddingBottom: 28,
};

const addressDetailsLocationRow = {
  minHeight: 70,
  flexDirection: 'row' as const,
  alignItems: 'flex-start' as const,
  gap: 18,
  marginBottom: 30,
};

const addressDetailsAddressTitle = {
  color: '#423120',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 19,
  lineHeight: 24,
};

const addressDetailsAddressSubtitle = {
  color: '#6F6258',
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 16,
  lineHeight: 21,
  marginTop: 5,
};

const addressDetailsTwoColumns = {
  flexDirection: 'row' as const,
  gap: 18,
  marginBottom: 20,
};

const addressDetailsFieldColumn = {
  flex: 1,
};

const addressDetailsFieldLabel = {
  color: '#6F6258',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 16,
  lineHeight: 21,
  marginBottom: 8,
};

const addressDetailsSmallInput = {
  minHeight: 58,
  borderRadius: 12,
  borderWidth: 1.5,
  borderColor: '#D7C3A7',
  paddingHorizontal: 14,
  color: '#423120',
  backgroundColor: '#F8F4EF',
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 17,
};

const addressDetailsLargeInput = {
  minHeight: 86,
  borderRadius: 12,
  borderWidth: 1.5,
  borderColor: '#D7C3A7',
  paddingHorizontal: 14,
  paddingTop: 12,
  color: '#423120',
  backgroundColor: '#F8F4EF',
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 17,
  marginBottom: 28,
};

const addressDetailsSectionTitle = {
  color: '#423120',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 25,
  lineHeight: 31,
};

const addressDetailsSectionSubtitle = {
  color: '#6F6258',
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 16,
  lineHeight: 21,
  marginTop: 2,
  marginBottom: 16,
};

const addressDetailsMapCard = {
  height: 168,
  overflow: 'hidden' as const,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#D7C3A7',
  backgroundColor: '#EDE3D8',
  marginBottom: 28,
};

const addressDetailsAdjustPin = {
  position: 'absolute' as const,
  bottom: 12,
  alignSelf: 'center' as const,
  minHeight: 42,
  paddingHorizontal: 24,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: '#D7C3A7',
  backgroundColor: '#F8F4EF',
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 5,
  elevation: 3,
};

const addressDetailsAdjustPinText = {
  color: '#423120',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 16,
};

const addressLabelSelector = {
  alignSelf: 'flex-start' as const,
  flexDirection: 'row' as const,
  padding: 4,
  borderRadius: 28,
  backgroundColor: '#EDE3D8',
};

const addressLabelOption = {
  minWidth: 106,
  minHeight: 44,
  paddingHorizontal: 18,
  borderRadius: 23,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const addressLabelOptionActive = {
  backgroundColor: '#F8F4EF',
  shadowColor: '#423120',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  elevation: 2,
};

const addressLabelOptionText = {
  color: '#423120',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 16,
};

const addressDetailsSaveButton = {
  minHeight: 58,
  borderRadius: 30,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: '#423120',
};

const addressDetailsStickyFooter = {
  paddingHorizontal: 24,
  paddingTop: 12,
  paddingBottom: 8,
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: 'rgba(66,49,32,0.14)',
  backgroundColor: '#F4EDE5',
  shadowColor: '#423120',
  shadowOffset: { width: 0, height: -3 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 8,
};

const addressDetailsSaveButtonText = {
  color: '#FFFFFF',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 18,
};

const locationBuildingSubtitle = {
  color: '#776C64',
  fontFamily: 'Philosopher-Regular' as const,
  fontSize: 16,
  lineHeight: 22,
  marginTop: -12,
  marginBottom: 20,
};

const locationBuildingGrid = {
  flexDirection: 'row' as const,
  flexWrap: 'wrap' as const,
  gap: 12,
};

const locationBuildingCard = {
  flexGrow: 1,
  flexBasis: '46%' as const,
  height: 95,
  padding: 14,
  borderRadius: 12,
  borderWidth: 1.5,
  borderColor: '#D7C3A7',
  justifyContent: 'space-between' as const,
  backgroundColor: '#F8F4EF',
};

const locationBuildingLabel = {
  color: '#423120',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 17,
};

const locationAddButton = {
  minHeight: 56,
  borderRadius: 28,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: '#D7C3A7',
  marginTop: 4,
};

const locationAddButtonText = {
  color: '#423120',
  fontFamily: 'Philosopher-Bold' as const,
  fontSize: 17,
};

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

const headerRow = {
  alignSelf: 'stretch' as const,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 10,
};

const headerBackButton = {
  width: 52,
  height: 52,
  borderRadius: 26,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  borderWidth: 1,
  overflow: 'hidden' as const,
};

const backNativeGlass = {
  backgroundColor: 'transparent',
  borderColor: 'rgba(255,255,255,0.72)',
};

const backBlurGlass = {
  backgroundColor: 'rgba(255,255,255,0.20)',
  borderColor: 'rgba(255,255,255,0.78)',
};

const backAndroid = {
  backgroundColor: '#D7C3A7',
  borderColor: '#C7AD8B',
  elevation: 3,
};

// Matches the location pill's soft drop shadow on iOS.
const backGlassShadow = {
  borderRadius: 26,
  shadowColor: '#423120',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.14,
  shadowRadius: 16,
};

const addPhotoFooter = {
  paddingHorizontal: 16,
  paddingTop: 12,
  backgroundColor: pageBg,
  borderTopWidth: 1,
  borderTopColor: 'rgba(66,49,32,0.08)',
};
