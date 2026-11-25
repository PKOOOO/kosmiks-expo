import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/config/constants';
import CategoryCardGrid from '@/components/CategoryCardGrid';
import { useT, type TKey } from '@/i18n';

const ADMIN_API_KEY = process.env.EXPO_PUBLIC_ADMIN_API_KEY || '';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const white = '#FFFFFF';
const red = '#c00';

const TOTAL_STEPS = 7;

const CITIES = [
  'Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Oulu',
  'Turku', 'Jyväskylä', 'Lahti', 'Kuopio', 'Pori',
  'Kouvola', 'Joensuu', 'Lappeenranta', 'Hämeenlinna', 'Vaasa',
];

const QUESTIONS: { question: TKey; hint?: TKey }[] = [
  { question: 'apply.qFirstName' },
  { question: 'apply.qLastName' },
  { question: 'apply.qPhone' },
  { question: 'apply.qCity' },
  { question: 'apply.qNeighbourhood', hint: 'apply.hNeighbourhood' },
  { question: 'apply.qAddress', hint: 'apply.hAddress' },
  { question: 'apply.qServices', hint: 'apply.hServices' },
];

type Category = { id: string; name: string };

export default function Phase1Screen() {
  const { t } = useT();
  const router = useRouter();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [neighbourhood, setNeighbourhood] = useState('');
  const [address, setAddress] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const firstNameRef = useRef<TextInputInstance>(null);
  const lastNameRef = useRef<TextInputInstance>(null);
  const phoneRef = useRef<TextInputInstance>(null);
  const neighRef = useRef<TextInputInstance>(null);
  const addressRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/public/categories`)
      .then(r => r.json())
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const refs = [firstNameRef, lastNameRef, phoneRef, null, neighRef, addressRef, null];
    const ref = refs[step];
    if (ref) {
      const t = setTimeout(() => ref.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [step]);

  const validate = (): boolean => {
    if (step === 0 && !firstName.trim()) { setError(t('apply.errFirstName')); return false; }
    if (step === 1 && !lastName.trim()) { setError(t('apply.errLastName')); return false; }
    if (step === 2 && !phone.trim()) { setError(t('apply.errPhone')); return false; }
    if (step === 3 && !city) { setError(t('apply.errCity')); return false; }
    if (step === 5 && !address.trim()) { setError(t('apply.errAddress')); return false; }
    if (step === 6 && !selectedCategories.length) { setError(t('apply.errServices')); return false; }
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

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = await getTokenRef.current();
      const res = await fetch(`${API_BASE_URL}/provider/apply/phase1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_API_KEY}`,
          'X-User-Token': token ?? '',
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          city,
          neighbourhood: neighbourhood.trim() || undefined,
          address: address.trim(),
          serviceCategories: selectedCategories,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      router.replace('/(onboarding)/pending' as any);
    } catch {
      Alert.alert(t('common.error'), t('apply.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategory = (name: string) => {
    setError('');
    setSelectedCategories(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const q = QUESTIONS[step];

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <TextInput
            ref={firstNameRef}
            value={firstName}
            onChangeText={v => { setFirstName(v); setError(''); }}
            placeholder="Matti"
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
            ref={lastNameRef}
            value={lastName}
            onChangeText={v => { setLastName(v); setError(''); }}
            placeholder="Meikäläinen"
            placeholderTextColor="#ccc"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={goNext}
            style={bigInput}
          />
        );
      case 2:
        return (
          <View style={{ flexDirection: 'row', borderWidth: 2, borderColor: beige, borderRadius: 14, overflow: 'hidden', backgroundColor: white }}>
            <View style={{ paddingHorizontal: 16, justifyContent: 'center', backgroundColor: lightBeige, borderRightWidth: 1, borderRightColor: beige }}>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 20, color: '#888' }}>+358</Text>
            </View>
            <TextInput
              ref={phoneRef}
              value={phone}
              onChangeText={v => { setPhone(v); setError(''); }}
              placeholder="40 123 4567"
              placeholderTextColor="#ccc"
              keyboardType="phone-pad"
              returnKeyType="next"
              onSubmitEditing={goNext}
              style={{ flex: 1, fontFamily: 'Philosopher-Regular', fontSize: 20, color: darkBrown, paddingHorizontal: 16, paddingVertical: 16 }}
            />
          </View>
        );
      case 3:
        return (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowCityPicker(true)}
            style={[bigInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
          >
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 20, color: city ? darkBrown : '#ccc', flex: 1 }}>
              {city || t('apply.selectCity')}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#aaa" />
          </TouchableOpacity>
        );
      case 4:
        return (
          <TextInput
            ref={neighRef}
            value={neighbourhood}
            onChangeText={v => { setNeighbourhood(v); setError(''); }}
            placeholder={t('apply.neighbourhoodPh')}
            placeholderTextColor="#ccc"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={goNext}
            style={bigInput}
          />
        );
      case 5:
        return (
          <TextInput
            ref={addressRef}
            value={address}
            onChangeText={v => { setAddress(v); setError(''); }}
            placeholder={t('apply.addressPh')}
            placeholderTextColor="#ccc"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={goNext}
            style={bigInput}
          />
        );
      case 6:
        return (
          <CategoryCardGrid
            categories={categories}
            selectedCategoryNames={selectedCategories}
            onCategoryPress={category => toggleCategory(category.name)}
            compact
          />
        );
    }
  };

  const isServicesStep = step === TOTAL_STEPS - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Progress bar */}
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

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          // The services step is a long list, so it starts higher to fit without scrolling.
          contentContainerStyle={{ paddingHorizontal: 28, paddingTop: isServicesStep ? 16 : 56, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={{
            fontFamily: 'Philosopher-Bold', color: darkBrown, marginBottom: q.hint ? 8 : 28,
            fontSize: isServicesStep ? 26 : 30, lineHeight: isServicesStep ? 32 : 38,
          }}>
            {t(q.question)}
          </Text>
          {q.hint ? (
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: '#999', marginBottom: isServicesStep ? 14 : 24, lineHeight: 20 }}>
              {t(q.hint)}
            </Text>
          ) : null}
          {renderStep()}
          {error ? (
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: red, marginTop: 12 }}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        {/* Continue button */}
        <View style={{ paddingHorizontal: 28, paddingBottom: insets.bottom + 16, paddingTop: 8 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={goNext}
            disabled={submitting}
            style={{ backgroundColor: darkBrown, borderRadius: 14, paddingVertical: 17, alignItems: 'center' }}
          >
            {submitting
              ? <ActivityIndicator color={white} />
              : <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: white }}>
                  {step === TOTAL_STEPS - 1 ? t('apply.submit') : t('apply.continue')}
                </Text>
            }
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

      {/* City picker */}
      {showCityPicker && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCityPicker(false)} />
          <View style={{ backgroundColor: white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 8 }}>
            <View style={{ width: 40, height: 4, backgroundColor: beige, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14 }}>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 18, color: darkBrown }}>{t('more.selectCity')}</Text>
              <TouchableOpacity onPress={() => setShowCityPicker(false)}>
                <Ionicons name="close" size={22} color={darkBrown} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {CITIES.map(c => (
                <TouchableOpacity
                  key={c}
                  activeOpacity={0.8}
                  onPress={() => { setCity(c); setShowCityPicker(false); setError(''); }}
                  style={{ paddingHorizontal: 24, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: lightBeige, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 16, color: darkBrown }}>{c}</Text>
                  {city === c && <Ionicons name="checkmark" size={18} color={darkBrown} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

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
