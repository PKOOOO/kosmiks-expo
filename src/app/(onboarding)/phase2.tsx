import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, Alert, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_BASE_URL } from '@/config/constants';
import { uploadImage } from '@/lib/upload-image';
import UploadProgress from '@/components/UploadProgress';

const ADMIN_API_KEY = process.env.EXPO_PUBLIC_ADMIN_API_KEY || '';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const white = '#FFFFFF';
const red = '#c00';

const TOTAL_STEPS = 6;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const formatDobDisplay = (d: Date) => `${pad2(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
const formatDobStore = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const parseDobStore = (s: string): Date | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
};
const isAtLeast18 = (dob: Date): boolean => {
  const today = new Date();
  const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return dob.getTime() <= cutoff.getTime();
};

const formatIban = (raw: string): string => {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18);
  let body = cleaned;
  if (cleaned.length >= 1 && cleaned[0] !== 'F') {
    body = 'FI' + cleaned.replace(/[^0-9]/g, '');
  } else if (cleaned.length >= 2 && cleaned.slice(0, 2) !== 'FI') {
    body = 'FI' + cleaned.slice(2).replace(/[^0-9]/g, '');
  } else if (cleaned.length >= 2) {
    body = 'FI' + cleaned.slice(2).replace(/[^0-9]/g, '');
  }
  body = body.slice(0, 18);
  return body.replace(/(.{4})/g, '$1 ').trim();
};

const isValidFinnishIban = (formatted: string): boolean => {
  const clean = formatted.replace(/\s+/g, '');
  return /^FI\d{16}$/.test(clean);
};

const QUESTIONS = [
  { question: 'What is your full legal name?', hint: 'As it appears on your ID document' },
  { question: 'What is your date of birth?', hint: 'You must be 18 or older to register' },
  { question: 'IBAN (Finnish bank account) *', hint: 'e.g. FI21 1234 5600 0007 85' },
  { question: 'Bank account holder name *', hint: 'Full name as shown on bank account' },
  { question: 'Your qualifications', hint: 'Upload documents proving you are qualified to provide beauty and spa services' },
  { question: 'Almost done', hint: 'Accept the terms to submit your application' },
];

// Step 5 asks for these one at a time. All three are required.
const DOCS = [
  { title: 'Diploma or certificate', icon: 'school-outline' },
  { title: 'Professional license', icon: 'ribbon-outline' },
  { title: 'Government ID', icon: 'card-outline' },
] as const;

const TERMS = [
  'Provide accurate information about yourself and your services.',
  'Honor all bookings made through the Servey platform.',
  'Maintain professional standards of service quality.',
  'Comply with all applicable Finnish laws and regulations.',
  'Allow Servey to collect a platform fee of 10% on each completed booking.',
  'Receive payouts via SEPA bank transfer to your provided IBAN.',
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

export default function Phase2Screen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [step, setStep] = useState(0);

  const [legalName, setLegalName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [iban, setIban] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  // `preview` is the local file shown in the slot; `url` is the private storage reference sent to the API.
  const [docSlots, setDocSlots] = useState<({ preview: string; url: string } | null)[]>([null, null, null]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [docStep, setDocStep] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const legalNameRef = useRef<TextInputInstance>(null);
  const ibanRef = useRef<TextInputInstance>(null);
  const bankAccountNameRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    const refs = [legalNameRef, null, ibanRef, bankAccountNameRef, null, null];
    const ref = refs[step];
    if (ref) {
      const t = setTimeout(() => ref.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [step]);

  const buildHeaders = async () => {
    const token = await getTokenRef.current();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_API_KEY}`,
      'X-User-Token': token ?? '',
    };
  };

  const compressImage = async (uri: string): Promise<string> => {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize({ width: 1200 });
    const ref = await ctx.renderAsync();
    const saved = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    return saved.uri;
  };

  const pickAndUploadDoc = async (slotIndex: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadProgress(0);
    setUploadingIndex(slotIndex);
    try {
      const compressedUri = await compressImage(asset.uri);
      const token = await getTokenRef.current();
      const { url } = await uploadImage({
        uri: compressedUri,
        authorization: `Bearer ${ADMIN_API_KEY}`,
        userToken: token ?? undefined,
        kind: 'document',
        onProgress: setUploadProgress,
      });
      setDocSlots(prev => { const next = [...prev]; next[slotIndex] = { preview: compressedUri, url }; return next; });
      setError('');
    } catch (err: any) {
      console.error('[UPLOAD] Error:', err?.message ?? err);
      Alert.alert('Upload failed', err?.message ?? 'Please try again.');
    } finally {
      setUploadingIndex(null);
    }
  };

  const removeDoc = (slotIndex: number) => {
    setDocSlots(prev => { const next = [...prev]; next[slotIndex] = null; return next; });
  };

  const validate = (): boolean => {
    if (step === 0 && !legalName.trim()) { setError('Please enter your full legal name'); return false; }
    if (step === 1) {
      const dob = parseDobStore(dateOfBirth);
      if (!dob) { setError('Please select your date of birth'); return false; }
      if (!isAtLeast18(dob)) { setError('You must be 18 or older to register'); return false; }
    }
    if (step === 2 && !isValidFinnishIban(iban)) { setError('IBAN must start with FI and have 16 digits'); return false; }
    if (step === 3 && !bankAccountName.trim()) { setError('Please enter the bank account holder name'); return false; }
    if (step === 4 && !docSlots[docStep]) {
      setError(`Please upload your ${DOCS[docStep].title.toLowerCase()}`);
      return false;
    }
    if (step === 5 && !termsAccepted) { setError('You must accept the terms to continue'); return false; }
    setError('');
    return true;
  };

  // Leave the documents step, or move to the next document within it.
  const advanceDoc = () => {
    if (docStep < DOCS.length - 1) { setDocStep(d => d + 1); return; }
    setStep(s => s + 1);
  };

  const goNext = () => {
    if (!validate()) return;
    if (step === 4) { advanceDoc(); return; }
    if (step === TOTAL_STEPS - 1) { handleSubmit(); return; }
    setStep(s => s + 1);
  };

  const goBack = () => {
    setError('');
    if (step === 4 && docStep > 0) { setDocStep(d => d - 1); return; }
    setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const headers = await buildHeaders();
      const res = await fetch(`${API_BASE_URL}/provider/apply/phase2`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          legalName: legalName.trim(),
          dateOfBirth,
          iban: iban.replace(/\s+/g, ''),
          bankAccountName: bankAccountName.trim(),
          qualificationDocs: docSlots.flatMap(slot => (slot ? [slot.url] : [])),
          termsAccepted: true,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error('[SUBMIT] Failed:', res.status, errBody);
        throw new Error(`${res.status}: ${errBody}`);
      }
      router.replace('/(onboarding)/pending' as any);
    } catch (err: any) {
      console.error('[SUBMIT] Error:', err?.message ?? err);
      Alert.alert('Error', err?.message ?? 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const q = step === 4
    ? { question: DOCS[docStep].title, hint: `Document ${docStep + 1} of ${DOCS.length}` }
    : QUESTIONS[step];

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <TextInput
            ref={legalNameRef}
            value={legalName}
            onChangeText={v => { setLegalName(v); setError(''); }}
            placeholder="Matti Meikäläinen"
            placeholderTextColor="#ccc"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={goNext}
            style={bigInput}
          />
        );

      case 1: {
        const today = new Date();
        const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
        const defaultDate = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
        const selected = parseDobStore(dateOfBirth);
        return (
          <>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowDobPicker(true)}
              style={{ ...bigInput, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Text style={{
                fontFamily: 'Philosopher-Regular',
                fontSize: 20,
                color: selected ? darkBrown : '#ccc',
              }}>
                {selected ? formatDobDisplay(selected) : 'Select date of birth'}
              </Text>
              <Ionicons name="calendar-outline" size={22} color={darkBrown} />
            </TouchableOpacity>
            {showDobPicker && (
              <DateTimePicker
                value={selected ?? defaultDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={maxDate}
                minimumDate={minDate}
                onChange={(event, date) => {
                  if (Platform.OS !== 'ios') setShowDobPicker(false);
                  if (event.type === 'dismissed') return;
                  if (date) {
                    setDateOfBirth(formatDobStore(date));
                    setError('');
                  }
                }}
              />
            )}
            {Platform.OS === 'ios' && showDobPicker && (
              <TouchableOpacity
                onPress={() => setShowDobPicker(false)}
                style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12 }}
              >
                <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: darkBrown }}>Done</Text>
              </TouchableOpacity>
            )}
          </>
        );
      }

      case 2:
        return (
          <TextInput
            ref={ibanRef}
            value={iban}
            onChangeText={v => { setIban(formatIban(v)); setError(''); }}
            placeholder="FI21 1234 5600 0007 85"
            placeholderTextColor="#ccc"
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
            returnKeyType="next"
            onSubmitEditing={goNext}
            style={bigInput}
            maxLength={22}
          />
        );

      case 3:
        return (
          <TextInput
            ref={bankAccountNameRef}
            value={bankAccountName}
            onChangeText={v => { setBankAccountName(v); setError(''); }}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={goNext}
            style={bigInput}
          />
        );

      case 4: {
        const doc = DOCS[docStep];
        const slot = docSlots[docStep];
        return (
          <View>
            {/* Sub-step dots: one document at a time */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
              {DOCS.map((_, i) => (
                <View
                  key={i}
                  style={{
                    height: 6, borderRadius: 3,
                    width: i === docStep ? 22 : 6,
                    backgroundColor: i === docStep ? darkBrown : docSlots[i] ? '#8A7560' : beige,
                  }}
                />
              ))}
            </View>

            {slot ? (
              <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: lightBeige }}>
                <Image source={{ uri: slot.preview }} style={{ width: '100%', aspectRatio: 4 / 3 }} resizeMode="cover" />
                <View style={{
                  position: 'absolute', left: 12, bottom: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 11, minHeight: 32, borderRadius: 16,
                  backgroundColor: 'rgba(66,49,32,0.84)',
                }}>
                  <Ionicons name="checkmark" size={14} color={white} />
                  <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 12, color: white }}>Uploaded</Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeDoc(docStep)}
                  accessibilityLabel={`Remove ${doc.title}`}
                  style={{
                    position: 'absolute', top: 10, right: 10,
                    width: 34, height: 34, borderRadius: 17,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(66,49,32,0.82)',
                  }}
                >
                  <Ionicons name="trash-outline" size={17} color={white} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => pickAndUploadDoc(docStep)}
                disabled={uploadingIndex !== null}
                style={{
                  borderWidth: 1.5,
                  borderColor: beige,
                  borderStyle: 'dashed',
                  borderRadius: 16,
                  aspectRatio: 4 / 3,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 24,
                  backgroundColor: lightBeige,
                }}
              >
                {uploadingIndex === docStep
                  ? <UploadProgress percent={uploadProgress} />
                  : (
                    <>
                      <View style={{
                        width: 52, height: 52, borderRadius: 26, marginBottom: 12,
                        alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDE3D8',
                      }}>
                        <Ionicons name={doc.icon} size={24} color={darkBrown} />
                      </View>
                      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: darkBrown }}>
                        Upload {doc.title.toLowerCase()}
                      </Text>
                    </>
                  )
                }
              </TouchableOpacity>
            )}

          </View>
        );
      }

      case 5:
        return (
          <View>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: '#555', lineHeight: 23, marginBottom: 16 }}>
              By joining Servey as a service provider, you agree to:
            </Text>
            {TERMS.map((term, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 14 }}>
                <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: darkBrown, width: 24, lineHeight: 23 }}>
                  {i + 1}.
                </Text>
                <Text style={{ flex: 1, fontFamily: 'Philosopher-Regular', fontSize: 15, color: '#555', lineHeight: 23 }}>
                  {term}
                </Text>
              </View>
            ))}
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: '#555', lineHeight: 23, marginTop: 4, marginBottom: 28 }}>
              Servey reserves the right to suspend providers who violate these terms.
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { setTermsAccepted(t => !t); setError(''); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}
            >
              <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: termsAccepted ? darkBrown : beige, backgroundColor: termsAccepted ? darkBrown : white, justifyContent: 'center', alignItems: 'center' }}>
                {termsAccepted && <Ionicons name="checkmark" size={14} color={white} />}
              </View>
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: darkBrown, flex: 1 }}>
                I agree to the Servey terms and conditions
              </Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

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
          contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 48, paddingBottom: 24 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 28, color: darkBrown, lineHeight: 36, marginBottom: q.hint ? 8 : 28 }}>
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
                  {step === TOTAL_STEPS - 1 ? 'Submit application' : 'Continue'}
                </Text>
            }
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
