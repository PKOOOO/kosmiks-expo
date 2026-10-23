// src/app/(app)/checkout.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckoutButton } from '@/components/CheckoutButton';
import { CustomerInfo } from '@/actions/checkout';
import { SaloonService } from '@/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import TimeSlotPicker, { formatSlotLabel } from '@/components/TimeSlotPicker';
import Header from '@/components/Header';
import SideMenu from '@/components/SideMenu';
import ReviewsSection from '@/components/ReviewsSection';
import { useAuth, useUser } from '@clerk/clerk-expo';

const dark = '#423120';
const beige = '#D7C3A7';
const cream = '#F4EDE5';
const sand = '#EDE3D8';
const muted = '#8A7F75';
const white = '#FFFFFF';
const pageBg = '#FFFFFF';

const eur = (n: number) => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n);

// "Kämmenselkä ja ranne (1 käsi)" → main name + the bracketed detail on its own line.
const splitServiceName = (name: string) => {
  const i = name.indexOf('(');
  return i > 0 ? { main: name.slice(0, i).trim(), detail: name.slice(i).trim() } : { main: name, detail: null };
};

const formatWorkType = (raw: string) => {
  const s = raw.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const params = useLocalSearchParams<{
    saloonId?: string;
    saloonName?: string;
    serviceId?: string;
    serviceName?: string;
    categoryName?: string;
    price?: string;
    durationMinutes?: string;
    workType?: string;
    date?: string;
    time?: string;
  }>();

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: user?.fullName || user?.firstName || '',
    email: user?.primaryEmailAddress?.emailAddress || '',
    phone: '',
    bookingTime: new Date().toISOString(),
    notes: '',
  });

  // Keep customerInfo in sync with Clerk user after sign-in
  useEffect(() => {
    if (user) {
      setCustomerInfo(prev => ({
        ...prev,
        name: user.fullName || user.firstName || prev.name,
        email: user.primaryEmailAddress?.emailAddress || prev.email,
      }));
    }
  }, [user]);

  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);
  // Slot highlighted in the picker but not yet confirmed — the "Jatka" button
  // lives in the sticky footer, outside the ScrollView.
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);

  const saloonService = useMemo(() => {
    if (params.saloonId && params.serviceId && params.price && params.durationMinutes) {
      return {
        saloonId: params.saloonId,
        serviceId: params.serviceId,
        price: parseFloat(params.price),
        durationMinutes: parseInt(params.durationMinutes),
        isAvailable: true,
        saloon: {
          id: params.saloonId,
          name: params.saloonName || 'Unknown Salon',
          userId: 'user-1',
          rating: 4.5,
        },
        service: {
          id: params.serviceId,
          name: params.serviceName || 'Unknown Service',
          description: `${params.serviceName} at ${params.saloonName}`,
          categoryId: 'cat-1',
          isPopular: false,
        },
      } as SaloonService;
    }
    return null;
  }, [params.saloonId, params.serviceId, params.price, params.durationMinutes, params.saloonName, params.serviceName]);

  // Hydrate booking time from URL params after sign-in redirect
  useEffect(() => {
    const pDate = typeof params.date === 'string' && params.date.length > 0 ? params.date : null;
    const pTime = typeof params.time === 'string' && params.time.length > 0 ? params.time : null;
    if (pDate && pTime && !bookingConfirmed) {
      const datetime = new Date(`${pDate}T${pTime}:00`).toISOString();
      setCustomerInfo(prev => ({ ...prev, bookingTime: datetime }));
      setBookingConfirmed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.date, params.time]);

  const handleSuccess = () => {
    router.replace('/(tabs)/profile');
  };

  const handleError = (error: Error) => {
    console.error('Booking error:', error.message);
  };

  const confirmSlot = (datetime: string) => {
    setCustomerInfo(prev => ({ ...prev, bookingTime: datetime }));
    setBookingConfirmed(true);
  };

  const changeTime = () => {
    setBookingConfirmed(false);
    setPendingSlot(null);
  };

  const goToSignIn = () => {
    const dt = new Date(customerInfo.bookingTime);
    // Local calendar date — toISOString() would shift it to UTC.
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const time = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
    const search = new URLSearchParams({
      ...(params.saloonId ? { saloonId: String(params.saloonId) } : {}),
      ...(params.saloonName ? { saloonName: String(params.saloonName) } : {}),
      ...(params.serviceId ? { serviceId: String(params.serviceId) } : {}),
      ...(params.serviceName ? { serviceName: String(params.serviceName) } : {}),
      ...(params.categoryName ? { categoryName: String(params.categoryName) } : {}),
      ...(params.price ? { price: String(params.price) } : {}),
      ...(params.durationMinutes ? { durationMinutes: String(params.durationMinutes) } : {}),
      ...(params.workType ? { workType: String(params.workType) } : {}),
      date,
      time,
    }).toString();
    router.push({ pathname: '/sign-in', params: { redirect: encodeURIComponent(`/(app)/checkout?${search}`) } });
  };

  const servicesToDisplay = saloonService ? [saloonService] : [];
  const isCustomerInfoComplete = !!(customerInfo.name && customerInfo.email);
  const canPickTime = !!params.saloonId && !!params.serviceId;
  const step: 1 | 2 = bookingConfirmed ? 2 : 1;
  // The page skips the bottom safe area (edges below) so the footer can run to
  // the screen edge and pad for the home indicator itself — no empty band under it.
  const footerBottom = Math.max(insets.bottom - 6, 12);

  const menu = (
    <Modal
      animationType="slide"
      transparent={false}
      visible={isMenuVisible}
      onRequestClose={() => setMenuVisible(false)}
      statusBarTranslucent
    >
      <SideMenu onClose={() => setMenuVisible(false)} />
    </Modal>
  );

  if (!saloonService) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: cream }}>
        <Header title="SERVEY" showBack showMenu onBackPress={() => router.back()} onMenuPress={() => setMenuVisible(true)} disableSafeAreaPadding />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={56} color={dark} style={{ marginBottom: 14, opacity: 0.5 }} />
          <Text style={{ fontSize: 18, fontFamily: 'Philosopher-Bold', color: dark, textAlign: 'center', marginBottom: 6 }}>
            Palvelua ei valittu
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'Philosopher-Regular', color: muted, textAlign: 'center', marginBottom: 22 }}>
            Valitse palvelu jatkaaksesi varausta
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: dark, height: 50, paddingHorizontal: 24, borderRadius: 25, justifyContent: 'center' }}>
            <Text style={{ fontSize: 16, fontFamily: 'Philosopher-Bold', color: white }}>Takaisin palveluihin</Text>
          </TouchableOpacity>
        </View>
        {menu}
      </SafeAreaView>
    );
  }

  const { main: serviceTitle, detail: serviceDetail } = splitServiceName(saloonService.service?.name || '');
  const when = step === 2 ? customerInfo.bookingTime : pendingSlot;

  return (
    // Top inset: iOS only — on Android the Header pads for the status bar itself.
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : ['left', 'right']} style={{ flex: 1, backgroundColor: pageBg }}>
      <Header title="SERVEY" showBack showMenu onBackPress={() => router.back()} onMenuPress={() => setMenuVisible(true)} disableSafeAreaPadding />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
      >
        {/* ── The ticket ─────────────────────────────────────────────── */}
        <BookingTicket
          salonName={saloonService.saloon?.name ?? ''}
          title={serviceTitle}
          detail={serviceDetail}
          workType={params.workType ? formatWorkType(params.workType) : null}
          durationMinutes={saloonService.durationMinutes}
          price={saloonService.price}
          when={when}
          confirmed={step === 2}
          onChangeTime={step === 2 && canPickTime ? changeTime : undefined}
        />

        {/* ── Steps ──────────────────────────────────────────────────── */}
        <StepBar step={step} />

        {step === 1 && canPickTime && (
          <View>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 24, color: dark, marginBottom: 4 }}>Milloin sinulle sopii?</Text>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: muted, marginBottom: 16 }}>
              Valitse päivä ja vapaa aika.
            </Text>
            <TimeSlotPicker
              saloonId={params.saloonId!}
              serviceId={params.serviceId!}
              onConfirm={confirmSlot}
              showConfirmButton={false}
              onSelectionChange={setPendingSlot}
            />
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 24, color: dark, marginBottom: 14 }}>Tarkista ja vahvista</Text>

            {isSignedIn ? (
              <DetailCard
                icon="person-outline"
                caption="Varaus tehdään nimelläsi"
                title={customerInfo.name || 'Nimi puuttuu'}
                body={customerInfo.email || 'Sähköposti puuttuu'}
              />
            ) : (
              <DetailCard
                icon="log-in-outline"
                caption="Valitsemasi aika säilyy"
                title="Kirjaudu sisään"
                body="Tarvitset tilin, jotta voit hallita varaustasi."
              />
            )}

            <View style={{ height: 10 }} />
            <DetailCard
              icon="lock-closed-outline"
              title="Turvallinen korttimaksu"
              body="Maksu käsitellään Stripen kautta. Saat vahvistuksen heti."
            />
          </View>
        )}

        {params.saloonId ? (
          <View style={{ marginTop: 32 }}>
            <ReviewsSection saloonId={params.saloonId} />
          </View>
        ) : null}
      </ScrollView>

      {/* ── Sticky footer: total + the one action ─────────────────────── */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: footerBottom,
        backgroundColor: white,
        borderTopWidth: 1,
        borderTopColor: '#EFE4D6',
        shadowColor: dark,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 12,
      }}>
        <View>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 20, color: dark }}>{eur(saloonService.price)}</Text>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: muted }}>{saloonService.durationMinutes} min</Text>
        </View>

        <View style={{ flex: 1 }}>
          {step === 1 ? (
            <PrimaryButton
              label={pendingSlot ? 'Jatka' : 'Valitse aika'}
              icon={pendingSlot ? 'arrow-forward' : undefined}
              disabled={!pendingSlot}
              onPress={() => pendingSlot && confirmSlot(pendingSlot)}
            />
          ) : isSignedIn ? (
            <CheckoutButton
              saloonServices={servicesToDisplay}
              customerInfo={customerInfo}
              onSuccess={handleSuccess}
              onError={handleError}
              disabled={!isCustomerInfoComplete}
            >
              Maksa ja varaa
            </CheckoutButton>
          ) : (
            <PrimaryButton label="Kirjaudu ja varaa" icon="log-in-outline" onPress={goToSignIn} />
          )}
        </View>
      </View>

      {menu}
    </SafeAreaView>
  );
}

// ─── Ticket ──────────────────────────────────────────────────────────────────

function BookingTicket({
  salonName, title, detail, workType, durationMinutes, price, when, confirmed, onChangeTime,
}: {
  salonName: string;
  title: string;
  detail: string | null;
  workType: string | null;
  durationMinutes: number;
  price: number;
  when: string | null;
  confirmed: boolean;
  onChangeTime?: () => void;
}) {
  return (
    <View style={{
      borderRadius: 26,
      backgroundColor: dark,
      shadowColor: dark,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.22,
      shadowRadius: 18,
      elevation: 8,
    }}>
      {/* Top: what */}
      <View style={{ padding: 22, paddingBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="storefront-outline" size={14} color={beige} />
          <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: beige, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            {salonName}
          </Text>
        </View>
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 28, lineHeight: 33, color: white, marginTop: 10 }}>{title}</Text>
        {detail ? (
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 16, color: beige, marginTop: 2 }}>{detail}</Text>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          <TicketChip icon="time-outline" label={`${durationMinutes} min`} />
          <TicketChip icon="pricetag-outline" label={eur(price)} />
          {workType ? <TicketChip icon="sparkles-outline" label={workType} /> : null}
        </View>
      </View>

      {/* Perforation: page-coloured notches + dashed tear line */}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: pageBg, marginLeft: -12 }} />
        <View style={{ flex: 1, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(215,195,167,0.45)', marginHorizontal: 6 }} />
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: pageBg, marginRight: -12 }} />
      </View>

      {/* Bottom: when — fills in live as the customer picks */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 22, paddingTop: 16, gap: 12 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
          backgroundColor: when ? beige : 'rgba(215,195,167,0.18)',
        }}>
          <Ionicons name={confirmed ? 'checkmark' : 'calendar-outline'} size={20} color={when ? dark : beige} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: beige }}>
            {confirmed ? 'Varattu aika' : 'Aika'}
          </Text>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 19, color: when ? white : 'rgba(255,255,255,0.55)', marginTop: 1 }}>
            {when ? formatSlotLabel(when) : 'Valitse aika alta'}
          </Text>
        </View>
        {onChangeTime ? (
          <TouchableOpacity
            onPress={onChangeTime}
            accessibilityRole="button"
            style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: 'rgba(215,195,167,0.2)' }}
          >
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: white }}>Muuta</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function TicketChip({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 11, borderRadius: 15,
      backgroundColor: 'rgba(215,195,167,0.16)',
    }}>
      <Ionicons name={icon} size={14} color={beige} />
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: white }}>{label}</Text>
    </View>
  );
}

// ─── Steps / cards / buttons ─────────────────────────────────────────────────

function StepBar({ step }: { step: 1 | 2 }) {
  const items = ['Aika', 'Vahvistus'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 22 }}>
      {items.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <React.Fragment key={label}>
            {i > 0 && <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: done || active ? dark : sand }} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{
                width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
                backgroundColor: active || done ? dark : sand,
              }}>
                {done
                  ? <Ionicons name="checkmark" size={14} color={white} />
                  : <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: active ? white : muted }}>{n}</Text>}
              </View>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: active || done ? dark : muted }}>{label}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

function DetailCard({
  icon, title, body, caption,
}: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string; caption?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, padding: 16, borderRadius: 20, backgroundColor: cream }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: white }}>
        <Ionicons name={icon} size={19} color={dark} />
      </View>
      <View style={{ flex: 1 }}>
        {caption ? <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: muted, marginBottom: 2 }}>{caption}</Text> : null}
        <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: dark }}>{title}</Text>
        <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: muted, marginTop: 2, lineHeight: 19 }}>{body}</Text>
      </View>
    </View>
  );
}

function PrimaryButton({
  label, icon, onPress, disabled,
}: { label: string; icon?: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={{
        height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: disabled ? sand : dark,
      }}
    >
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: disabled ? muted : white }}>{label}</Text>
      {icon ? <Ionicons name={icon} size={18} color={disabled ? muted : white} /> : null}
    </TouchableOpacity>
  );
}
