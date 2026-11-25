import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, Platform, ActivityIndicator, Linking, Dimensions,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { adminRequest } from '@/lib/admin-api';
import { reverseGeocode } from '@/lib/geocode';
import { formatEur, formatDay } from '@/lib/earnings';
import {
  SubpageHeader, Card, SectionLabel, InfoRow, ListRow, Chip, EmptyState, shortArea, colors, relativeDay,
} from '@/components/admin/AdminUI';
import { usePageBottomSpace } from '@/lib/layout';
import RemoteImage from '@/components/RemoteImage';
import { useT } from '@/i18n';

type SaloonDetail = {
  id: string;
  name: string;
  shortIntro: string | null;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  createdAt: string;
  images: { id: string; url: string }[];
  saloonServices: {
    serviceId: string;
    price: number;
    durationMinutes: number;
    isAvailable: boolean;
    service: { name: string; category: { name: string } | null };
  }[];
  bookings: {
    id: string;
    bookingTime: string;
    status: string;
    totalAmount: number | null;
    customerName: string | null;
    service: { name: string } | null;
  }[];
  _count: { bookings: number; reviews: number };
  owner: { name: string | null; email: string | null; phone: string | null; city: string | null; neighbourhood: string | null };
  revenue: number;
  paidBookings: number;
};

const PHOTO_W = Dimensions.get('window').width - 32;

const BOOKING_TONE: Record<string, 'green' | 'amber' | 'red' | 'neutral'> = {
  confirmed: 'green', completed: 'green', pending: 'amber', cancelled: 'red', no_show: 'red',
};

export default function AdminSaloonDetailScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const pageBottom = usePageBottomSpace();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [saloon, setSaloon] = useState<SaloonDetail | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminRequest<SaloonDetail>(() => getTokenRef.current(), `/admin/saloons/${id}`);
      setSaloon(data);
      if (!shortArea(data.address) && data.latitude != null && data.longitude != null) {
        setResolvedAddress(await reverseGeocode(data.latitude, data.longitude));
      }
    } catch {
      setError(t('adetail.salonFailed'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const address = saloon ? (shortArea(saloon.address) ? saloon.address : resolvedAddress) : null;
  const openMaps = () => {
    if (!saloon || saloon.latitude == null || saloon.longitude == null) return;
    const { latitude: lat, longitude: lng } = saloon;
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(saloon.name)}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(saloon.name)})`;
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <SafeAreaView edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={{ flex: 1, backgroundColor: colors.sand }}>
      <SubpageHeader title={saloon?.name ?? t('adetail.salon')} />
      {loading ? (
        <ActivityIndicator size="large" color={colors.dark} style={{ marginTop: 40 }} />
      ) : !saloon ? (
        <EmptyState icon="storefront-outline" title={error ?? t('adetail.salonNotFound')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: pageBottom }} showsVerticalScrollIndicator={false}>
          {/* Photos */}
          {saloon.images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled={false}
              snapToInterval={PHOTO_W + 10}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            >
              {saloon.images.map(img => (
                <RemoteImage key={img.id} source={{ uri: img.url }} style={{ width: PHOTO_W, height: Math.round(PHOTO_W * 0.62), borderRadius: 18, backgroundColor: colors.white }} />
              ))}
            </ScrollView>
          ) : (
            <View style={{ marginHorizontal: 16 }}>
              <Card style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="image-outline" size={26} color={colors.muted} />
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 4 }}>{t('more.noPhotos')}</Text>
              </Card>
            </View>
          )}

          <View style={{ paddingHorizontal: 16 }}>
            {saloon.shortIntro ? (
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 15, color: colors.dark, marginTop: 14, lineHeight: 21 }}>
                {saloon.shortIntro}
              </Text>
            ) : null}

            {/* Numbers */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Stat label={t('adetail.revenue')} value={formatEur(saloon.revenue)} />
              <Stat label={t('adetail.paidBookings')} value={String(saloon.paidBookings)} />
              <Stat label={t('adetail.reviews')} value={String(saloon._count.reviews)} />
            </View>

            <SectionLabel>{t('adetail.owner')}</SectionLabel>
            <Card>
              <InfoRow label={t('adetail.name')} value={saloon.owner.name} />
              <InfoRow label={t('adetail.email')} value={saloon.owner.email} />
              <InfoRow
                label={t('adetail.phone')}
                value={saloon.owner.phone}
                right={saloon.owner.phone ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${saloon.owner.phone}`).catch(() => undefined)} accessibilityLabel={t('adetail.callOwner')}>
                    <Ionicons name="call-outline" size={18} color={colors.muted} />
                  </TouchableOpacity>
                ) : undefined}
              />
              <InfoRow label={t('adetail.joined')} value={relativeDay(saloon.createdAt)} last />
            </Card>

            <SectionLabel>{t('adetail.location')}</SectionLabel>
            <Card>
              <ListRow
                icon="location-outline"
                title={address || t('adetail.noAddressSaved')}
                subtitle={saloon.latitude != null ? t('adetail.openInMaps') : undefined}
                onPress={saloon.latitude != null ? openMaps : undefined}
                last
              />
            </Card>

            <SectionLabel>{`Services (${saloon.saloonServices.length})`}</SectionLabel>
            {saloon.saloonServices.length === 0 ? (
              <Card style={{ padding: 16 }}>
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted }}>{t('more.noServicesAdded')}</Text>
              </Card>
            ) : (
              <Card>
                {saloon.saloonServices.map((s, i) => (
                  <ListRow
                    key={s.serviceId}
                    title={s.service.name}
                    subtitle={t('adetail.serviceLine', { category: s.service.category?.name ? `${s.service.category.name} · ` : '', minutes: s.durationMinutes, hidden: s.isAvailable ? '' : t('adetail.hidden') })}
                    trailing={formatEur(s.price)}
                    last={i === saloon.saloonServices.length - 1}
                  />
                ))}
              </Card>
            )}

            <SectionLabel>{t('adetail.recentBookings')}</SectionLabel>
            {saloon.bookings.length === 0 ? (
              <Card style={{ padding: 16 }}>
                <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: colors.muted }}>{t('more.noBookingsYet')}</Text>
              </Card>
            ) : (
              <Card>
                {saloon.bookings.map((b, i) => (
                  <View
                    key={b.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13,
                      borderBottomWidth: i < saloon.bookings.length - 1 ? 1 : 0, borderBottomColor: colors.line,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>
                        {b.service?.name ?? t('adetail.service')}
                      </Text>
                      <Text numberOfLines={1} style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: colors.muted, marginTop: 2 }}>
                        {b.customerName || t('adetail.customer')} · {formatDay(new Date(b.bookingTime))}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 5 }}>
                      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: colors.dark }}>{formatEur(b.totalAmount ?? 0)}</Text>
                      <Chip label={({ pending: t('adetail.stPending'), confirmed: t('adetail.stConfirmed'), completed: t('adetail.stCompleted'), cancelled: t('adetail.stCancelled'), no_show: t('adetail.stNoShow') } as Record<string, string>)[b.status] ?? b.status.replace('_', ' ')} tone={BOOKING_TONE[b.status] ?? 'neutral'} />
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center' }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Philosopher-Bold', fontSize: 18, color: colors.dark }}>{value}</Text>
      <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: colors.muted, marginTop: 1 }}>{label}</Text>
    </Card>
  );
}
