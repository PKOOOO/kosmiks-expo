import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/config/constants';
import useProviderServicesStore from '@/store/provider-services.store';
import BrandHeader from '@/components/BrandHeader';
import RemoteImage from '@/components/RemoteImage';

const colors = {
  brown: '#423120',
  beige: '#D7C3A7',
  cream: '#F8F4EF',
  pale: '#F1E8DD',
  white: '#FFFFFF',
  ink: '#281E17',
  muted: '#776C64',
  badgeGreen: '#25D366',
};

const dayColors = ['#CBB7D8', '#D5A0AA', '#8DCEC8', '#BED596', '#E4C47D'];

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

type Booking = {
  id: string;
  bookingTime: string;
  durationMinutes: number;
  totalAmount: number;
  status: BookingStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAvatar?: string;
  notes?: string;
  service: { name: string };
  user?: {
    name: string;
    email: string;
    imageUrl?: string;
    avatar?: string;
  } | null;
};

type ScreenMode = 'calendar' | 'day' | 'detail';

const normalizeApiBooking = (raw: Record<string, any>): Booking | null => {
  const bookingTime = raw.bookingTime || raw.startTime || raw.date;
  if (!raw.id || !bookingTime || Number.isNaN(+new Date(bookingTime))) return null;

  const rawStatus = String(raw.status || 'pending').toLowerCase();
  const status: BookingStatus = ['pending', 'confirmed', 'completed', 'cancelled'].includes(rawStatus)
    ? rawStatus as BookingStatus
    : 'pending';
  const rawUser = raw.user && typeof raw.user === 'object' ? raw.user : null;
  const service = raw.subService || raw.service?.subService || raw.service;

  return {
    id: String(raw.id),
    bookingTime: new Date(bookingTime).toISOString(),
    durationMinutes: Number(raw.durationMinutes || service?.durationMinutes || raw.saloonService?.durationMinutes || 30),
    totalAmount: Number(raw.totalAmount ?? raw.price ?? raw.saloonService?.price ?? 0),
    status,
    customerName: raw.customerName || rawUser?.name || 'Customer',
    customerPhone: raw.customerPhone || rawUser?.phoneNumber || '',
    customerEmail: raw.customerEmail || rawUser?.email || '',
    customerAvatar: raw.customerAvatar || raw.customerImageUrl || rawUser?.imageUrl || rawUser?.avatar,
    notes: raw.notes || undefined,
    service: { name: service?.name || raw.serviceName || 'Service' },
    user: rawUser ? {
      name: rawUser.name || raw.customerName || 'Customer',
      email: rawUser.email || raw.customerEmail || '',
      imageUrl: rawUser.imageUrl,
      avatar: rawUser.avatar,
    } : null,
  };
};

const dateKey = (value: Date | string) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2)
  .map((part) => part[0]?.toUpperCase()).join('');

// When live data is restored, the API can provide any of these Clerk avatar fields.
const customerAvatar = (booking: Booking) =>
  booking.customerAvatar || booking.user?.imageUrl || booking.user?.avatar;

function Avatar({ name, uri, size = 36 }: { name: string; uri?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri && !failed ? (
        <RemoteImage source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.avatarInitials, { fontSize: size * 0.33 }]}>{initials(name)}</Text>
      )}
    </View>
  );
}

function CalendarView({ bookings, onSelectDate }: {
  bookings: Booking[];
  onSelectDate: (date: Date) => void;
}) {
  const initialMonth = new Date();
  initialMonth.setDate(1);
  const [month, setMonth] = useState(initialMonth);

  const groupedDays = useMemo(() => {
    const groups = new Map<string, Booking[]>();
    bookings
      .filter((booking) => {
        const date = new Date(booking.bookingTime);
        return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
      })
      .sort((a, b) => +new Date(a.bookingTime) - +new Date(b.bookingTime))
      .forEach((booking) => {
        const key = dateKey(booking.bookingTime);
        groups.set(key, [...(groups.get(key) || []), booking]);
      });
    return Array.from(groups.values());
  }, [bookings, month]);

  const moveMonth = (difference: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + difference, 1));
  };
  const previous = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  return (
    <>
      <View style={styles.monthPicker}>
        <TouchableOpacity style={styles.sideMonth} onPress={() => moveMonth(-1)}>
          <Ionicons name="chevron-back" size={16} color={colors.muted} />
          <Text style={styles.sideMonthText}>{previous.toLocaleDateString('en', { month: 'short' })}</Text>
        </TouchableOpacity>
        <Text style={styles.currentMonth}>{month.toLocaleDateString('en', { month: 'short', year: 'numeric' })}</Text>
        <TouchableOpacity style={[styles.sideMonth, { justifyContent: 'flex-end' }]} onPress={() => moveMonth(1)}>
          <Text style={styles.sideMonthText}>{next.toLocaleDateString('en', { month: 'short' })}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>
      <View style={styles.calendarList}>
        {groupedDays.length === 0 ? (
          <View style={styles.emptyMonth}>
            <Ionicons name="calendar-outline" size={42} color={colors.beige} />
            <Text style={styles.emptyMonthText}>No bookings this month.</Text>
          </View>
        ) : groupedDays.map((items, index) => {
          const date = new Date(items[0].bookingTime);
          return (
            <TouchableOpacity
              key={dateKey(date)}
              activeOpacity={0.88}
              onPress={() => onSelectDate(date)}
              style={[styles.calendarCard, { backgroundColor: dayColors[index % dayColors.length] }]}
            >
              <View style={styles.calendarDateBlock}>
                <Text style={styles.calendarWeekday}>{date.toLocaleDateString('en', { weekday: 'long' })}</Text>
                <Text style={styles.calendarDay}>{date.getDate()}</Text>
                <Text style={styles.calendarMonth}>{date.toLocaleDateString('en', { month: 'short' })}</Text>
              </View>
              <View style={styles.calendarSlots}>
                {items.map((booking) => (
                  <View key={booking.id} style={styles.calendarSlot}>
                    <Text style={styles.slotTime}>{formatTime(booking.bookingTime)}</Text>
                    <Avatar
                      name={booking.customerName}
                      uri={customerAvatar(booking)}
                      size={42}
                    />
                  </View>
                ))}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.brown} style={styles.cardChevron} />
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

function DayView({ date, bookings, providerAvatar, providerName, bottomPadding, onBack, onSelectBooking }: {
  date: Date;
  bookings: Booking[];
  providerAvatar?: string;
  providerName: string;
  bottomPadding: number;
  onBack: () => void;
  onSelectBooking: (booking: Booking) => void;
}) {
  const dayBookings = bookings
    .filter((booking) => dateKey(booking.bookingTime) === dateKey(date))
    .sort((a, b) => +new Date(a.bookingTime) - +new Date(b.bookingTime));

  return (
    <View style={styles.dayPage}>
      <View style={styles.dayHero}>
        <TouchableOpacity
          accessibilityLabel="Back to bookings calendar"
          onPress={onBack}
          style={styles.dayBackButton}
        >
          <Ionicons name="arrow-back" size={22} color={colors.brown} />
        </TouchableOpacity>
        <View style={styles.dayDateArea}>
          <Text style={styles.dayWeekday}>{date.toLocaleDateString('en', { weekday: 'long' })}</Text>
          <View style={styles.dayDateRow}>
            <Text style={styles.dayNumber}>{date.getDate()}</Text>
            <Text style={styles.dayDot}>.</Text>
            <View style={styles.dayMonthWrap}>
              <Text style={styles.dayMonth}>{date.toLocaleDateString('en', { month: 'short' }).toUpperCase()}</Text>
              {dayBookings.length > 0 ? (
                <View style={styles.dayCountBadge}>
                  <Text style={styles.dayCountText}>{dayBookings.length}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>
      <ScrollView
        style={styles.dayBookingsScroll}
        contentContainerStyle={[styles.tasksPanel, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {dayBookings.length === 0 ? (
          <View style={styles.noBookingsCard}><Text style={styles.noBookingsText}>No bookings on this date.</Text></View>
        ) : dayBookings.map((booking, index) => {
          const cardColors = ['#E8C471', '#B8C5C6', '#CBB7D8'];
          return (
            <TouchableOpacity
              key={booking.id}
              activeOpacity={0.9}
              onPress={() => onSelectBooking(booking)}
              style={[styles.bookingCard, { backgroundColor: cardColors[index % cardColors.length] }]}
            >
              <View style={styles.bookingCardTop}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.bookingCustomer}>{booking.customerName}</Text>
                  <Text numberOfLines={2} style={styles.bookingService}>{booking.service.name}</Text>
                </View>
                <View style={styles.avatarStack}>
                  <Avatar name={booking.customerName} uri={customerAvatar(booking)} size={34} />
                  <View style={styles.overlappingAvatar}><Avatar name={providerName} uri={providerAvatar} size={34} /></View>
                </View>
              </View>
              <View style={styles.bookingDurationRow}>
                <View style={styles.durationPill}><Text style={styles.durationText}>{booking.durationMinutes} min</Text></View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function DetailView({ booking, providerAvatar, providerName, onClose, onStatusChange }: {
  booking: Booking;
  providerAvatar?: string;
  providerName: string;
  onClose: () => void;
  onStatusChange: (status: BookingStatus) => void;
}) {
  const serviceTitle = booking.service.name.replace(/\s+(\([^)]*\))\s*$/, '\n$1');

  return (
    <View style={styles.detailPage}>
      <View style={styles.detailTopBar}>
        <TouchableOpacity onPress={onClose} style={styles.darkIconButton}><Ionicons name="close" size={22} color={colors.brown} /></TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll}>
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{serviceTitle}</Text>
          <View style={styles.detailTiles}>
            <View style={styles.detailTile}>
              <Text style={styles.tileSmall}>Booking status</Text>
              <Ionicons name={booking.status === 'confirmed' ? 'checkmark-circle' : 'time'} size={34} color={colors.brown} />
              <Text style={styles.tileUnit}>{booking.status.toUpperCase()}</Text>
            </View>
            <View style={styles.detailTile}>
              <Text style={styles.tileSmall}>Total price</Text><Text style={styles.priceTile}>€{booking.totalAmount.toFixed(2)}</Text>
              <Text style={styles.tileUnit}>AT THE SALON</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.personRow}>
            <Avatar name={booking.customerName} uri={customerAvatar(booking)} size={42} />
            <View style={styles.personText}>
              <Text style={styles.personName}>{booking.customerName}</Text><Text style={styles.personSub}>{booking.customerEmail}</Text>
              <Text style={styles.personSub}>{booking.customerPhone}</Text>
            </View>
            <TouchableOpacity style={styles.contactButton}><Ionicons name="call" size={18} color={colors.brown} /></TouchableOpacity>
            <TouchableOpacity style={styles.contactButton}><Ionicons name="chatbox" size={18} color={colors.brown} /></TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <View style={styles.detailFooter}>
        <TouchableOpacity onPress={() => onStatusChange('confirmed')} style={[styles.footerAction, styles.confirmAction]}><Text style={styles.confirmText}>Confirm</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => onStatusChange('pending')} style={styles.footerAction}><Text style={styles.footerActionText}>Pending</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => onStatusChange('cancelled')} style={styles.footerAction}><Text style={styles.footerActionText}>Cancel</Text></TouchableOpacity>
      </View>
    </View>
  );
}

export default function ProviderBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { getToken } = useAuth();
  const setTabBarHidden = useProviderServicesStore((state) => state.setTabBarHidden);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [mode, setMode] = useState<ScreenMode>('calendar');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) || null;
  const providerName = user?.fullName || user?.firstName || 'Service provider';
  const providerAvatar = user?.imageUrl;

  useEffect(() => {
    setTabBarHidden(mode === 'detail');
    return () => setTabBarHidden(false);
  }, [mode, setTabBarHidden]);

  const loadRealBookings = useCallback(async () => {
    try {
      setSyncError(null);
      const token = await getToken();
      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Bearer ${token ?? ''}`,
      };
      if (token) headers['X-User-Token'] = token;

      const response = await fetch(`${API_BASE_URL}/provider/bookings`, { headers });
      if (!response.ok) throw new Error(`Bookings request failed: ${response.status}`);

      const payload = await response.json();
      const rawBookings = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.bookings)
          ? payload.bookings
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
      const liveBookings = (rawBookings as Record<string, any>[])
        .map(normalizeApiBooking)
        .filter((booking: Booking | null): booking is Booking => booking !== null);

      setBookings(liveBookings);
    } catch (error) {
      console.log('[ProviderBookings] Could not load historical bookings', error);
      setSyncError('Could not load your saved bookings. Pull down to retry.');
    } finally {
      setRefreshing(false);
    }
  }, [getToken]);

  useFocusEffect(useCallback(() => {
    loadRealBookings();
  }, [loadRealBookings]));

  const openDay = (date: Date) => {
    setSelectedDate(date); setSelectedBookingId(null); setMode('day');
  };
  const updateSelectedStatus = async (status: BookingStatus) => {
    if (!selectedBookingId) return;
    const previousStatus = selectedBooking?.status;
    setBookings((current) => current.map((booking) => booking.id === selectedBookingId ? { ...booking, status } : booking));

    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token ?? ''}`,
      };
      if (token) headers['X-User-Token'] = token;
      const response = await fetch(`${API_BASE_URL}/provider/bookings/${selectedBookingId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(`Status update failed: ${response.status}`);
    } catch {
      if (previousStatus) {
        setBookings((current) => current.map((booking) =>
          booking.id === selectedBookingId ? { ...booking, status: previousStatus } : booking
        ));
      }
      Alert.alert('Could not update booking', 'Please try again.');
    }
  };

  if (mode === 'detail' && selectedBooking) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.detailSafeArea}>
        <DetailView booking={selectedBooking} providerAvatar={providerAvatar} providerName={providerName}
          onClose={() => setMode('day')} onStatusChange={updateSelectedStatus} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={styles.safeArea}>
      {mode === 'calendar' ? (
        <>
        <BrandHeader />
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadRealBookings(); }}
              tintColor={colors.brown}
              colors={[colors.brown]}
            />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 115 }}
        >
          {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
          <CalendarView bookings={bookings} onSelectDate={openDay} />
        </ScrollView>
        </>
      ) : (
        <>
          {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
          <DayView date={selectedDate} bookings={bookings} providerAvatar={providerAvatar} providerName={providerName}
            bottomPadding={insets.bottom + 115}
            onBack={() => setMode('calendar')}
            onSelectBooking={(booking) => { setSelectedBookingId(booking.id); setMode('detail'); }} />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  syncError: { marginHorizontal: 18, marginBottom: 10, fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#A14949', textAlign: 'center' },
  monthPicker: { marginHorizontal: 14, marginTop: 16, paddingHorizontal: 14, height: 58, borderRadius: 24, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideMonth: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 68 },
  sideMonthText: { fontFamily: 'Philosopher-Regular', fontSize: 17, color: colors.muted },
  currentMonth: { fontFamily: 'Philosopher-Bold', fontSize: 21, color: colors.ink },
  calendarList: { paddingHorizontal: 14, paddingTop: 8, gap: 7 },
  calendarCard: { minHeight: 138, borderRadius: 20, padding: 14, flexDirection: 'row', overflow: 'hidden' },
  calendarDateBlock: { width: 94, justifyContent: 'center' },
  calendarWeekday: { fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.ink },
  calendarDay: { fontFamily: 'Philosopher-Regular', fontSize: 47, lineHeight: 50, color: colors.ink },
  calendarMonth: { fontFamily: 'Philosopher-Regular', fontSize: 35, lineHeight: 37, color: colors.ink, textTransform: 'uppercase' },
  calendarSlots: { flex: 1, flexDirection: 'row', paddingRight: 12 },
  calendarSlot: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderLeftColor: 'rgba(66,49,32,0.48)', paddingHorizontal: 4, alignItems: 'center', justifyContent: 'space-around' },
  slotTime: { fontFamily: 'Philosopher-Regular', fontSize: 11, color: colors.ink, textAlign: 'center' },
  cardChevron: { position: 'absolute', right: 5, top: 59 },
  emptyMonth: { paddingVertical: 70, alignItems: 'center', gap: 12 },
  emptyMonthText: { fontFamily: 'Philosopher-Regular', color: colors.muted, fontSize: 16 },
  dayPage: { flex: 1 },
  dayHero: { minHeight: 104, paddingHorizontal: 18, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayBackButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.beige, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  dayDateArea: { flex: 1, alignItems: 'flex-end', paddingRight: 12 },
  dayWeekday: { fontFamily: 'Philosopher-Regular', color: colors.ink, fontSize: 13, paddingRight: 2 },
  dayDateRow: { flexDirection: 'row', alignItems: 'baseline' },
  dayNumber: { fontFamily: 'Philosopher-Regular', fontSize: 42, lineHeight: 45, color: colors.ink },
  dayDot: { fontFamily: 'Philosopher-Regular', fontSize: 33, color: colors.ink },
  dayMonth: { fontFamily: 'Philosopher-Regular', fontSize: 33, color: colors.ink },
  dayMonthWrap: { position: 'relative' },
  dayCountBadge: { position: 'absolute', top: -8, right: -12, minWidth: 21, height: 21, paddingHorizontal: 4, borderRadius: 11, backgroundColor: colors.badgeGreen, borderWidth: 2, borderColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  dayCountText: { fontFamily: 'Philosopher-Bold', fontSize: 10, color: colors.white },
  dayBookingsScroll: { flex: 1 },
  tasksPanel: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 10 },
  noBookingsCard: { padding: 35, borderRadius: 20, backgroundColor: colors.cream, alignItems: 'center' },
  noBookingsText: { fontFamily: 'Philosopher-Regular', fontSize: 16, color: colors.muted },
  bookingCard: { minHeight: 144, borderRadius: 21, padding: 15, marginBottom: 8 },
  bookingCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bookingCustomer: { fontFamily: 'Philosopher-Regular', fontSize: 16, color: colors.brown },
  bookingService: { fontFamily: 'Philosopher-Bold', fontSize: 24, lineHeight: 26, color: colors.brown, marginTop: 3 },
  avatarStack: { flexDirection: 'row', alignItems: 'center', paddingTop: 2 },
  overlappingAvatar: { marginLeft: -10 },
  avatar: { backgroundColor: colors.beige, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarInitials: { fontFamily: 'Philosopher-Bold', color: colors.brown },
  bookingDurationRow: { marginTop: 16, flexDirection: 'row', justifyContent: 'flex-start' },
  durationPill: { borderRadius: 18, backgroundColor: colors.brown, paddingHorizontal: 14, paddingVertical: 7 },
  durationText: { fontFamily: 'Philosopher-Regular', fontSize: 12, color: colors.white },
  detailSafeArea: { flex: 1, backgroundColor: colors.cream },
  detailPage: { flex: 1, backgroundColor: colors.cream },
  detailTopBar: { height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  darkIconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.pale, borderWidth: 1, borderColor: colors.beige, alignItems: 'center', justifyContent: 'center' },
  detailScroll: { paddingHorizontal: 12, paddingBottom: 118 },
  detailCard: { backgroundColor: colors.white, borderRadius: 23, borderWidth: 1, borderColor: colors.beige, padding: 16 },
  detailTitle: { flexShrink: 1, maxWidth: '100%', fontFamily: 'Philosopher-Bold', fontSize: 23, lineHeight: 28, color: colors.brown },
  detailTiles: { flexDirection: 'row', gap: 8, marginTop: 18 },
  detailTile: { flex: 1, minHeight: 112, borderRadius: 18, overflow: 'hidden', padding: 12, backgroundColor: colors.pale, borderWidth: 1, borderColor: colors.beige, alignItems: 'center', justifyContent: 'space-between' },
  tileSmall: { fontFamily: 'Philosopher-Regular', fontSize: 12, textAlign: 'center', color: colors.brown },
  tileUnit: { fontFamily: 'Philosopher-Bold', fontSize: 10, color: colors.brown, textAlign: 'center' },
  priceTile: { fontFamily: 'Philosopher-Bold', fontSize: 22, color: colors.brown },
  sectionTitle: { fontFamily: 'Philosopher-Bold', fontSize: 17, color: colors.brown, marginTop: 20, marginBottom: 8 },
  personRow: { flexDirection: 'row', alignItems: 'center', minHeight: 54 },
  personText: { flex: 1, marginLeft: 10 },
  personName: { fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.brown },
  personSub: { fontFamily: 'Philosopher-Regular', fontSize: 11, color: colors.muted, marginTop: 1 },
  contactButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 7, backgroundColor: colors.pale, borderWidth: 1, borderColor: colors.beige },
  detailFooter: { position: 'absolute', left: 20, right: 20, bottom: 16, height: 50, flexDirection: 'row', gap: 10 },
  footerAction: { flex: 1, borderRadius: 24, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.beige },
  confirmAction: { backgroundColor: colors.brown, borderColor: colors.brown },
  confirmText: { fontFamily: 'Philosopher-Bold', color: colors.white, fontSize: 14 },
  footerActionText: { fontFamily: 'Philosopher-Bold', color: colors.brown, fontSize: 14 },
});
