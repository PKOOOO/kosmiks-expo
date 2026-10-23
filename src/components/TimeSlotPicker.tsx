import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/config/constants';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const sand = '#EDE3D8';
const muted = '#8A7F75';
const white = '#FFFFFF';

const DAYS_AHEAD = 21;

type Slot = { time: string; datetime: string };

type Props = {
  saloonId: string;
  serviceId: string;
  onConfirm: (datetime: string) => void;
  /** Hide the inline confirm button so the parent can render it in a sticky footer. */
  showConfirmButton?: boolean;
  /** Fires with the selected datetime, or null when the selection is cleared. */
  onSelectionChange?: (datetime: string | null) => void;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "La 24.10. klo 10.30" — the chosen slot in Finnish date/time style. */
export const formatSlotLabel = (datetime: string) => {
  const d = new Date(datetime);
  const weekday = capitalise(d.toLocaleDateString('fi-FI', { weekday: 'short' }));
  return `${weekday} ${d.getDate()}.${d.getMonth() + 1}. klo ${pad2(d.getHours())}.${pad2(d.getMinutes())}`;
};

/**
 * The confirm action, exported so a parent can pin it to the bottom of the
 * screen (outside the ScrollView) while the picker itself stays scrollable.
 */
export function ConfirmBookingTimeButton({
  enabled,
  onPress,
  selected,
}: {
  enabled: boolean;
  onPress: () => void;
  /** Chosen slot's datetime — shown on the button so the choice is always visible. */
  selected?: string | null;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!enabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      style={{
        backgroundColor: enabled ? darkBrown : sand,
        borderRadius: 26,
        height: 54,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: enabled ? white : muted }}>
        {enabled && selected ? `Jatka · ${formatSlotLabel(selected)}` : 'Valitse aika'}
      </Text>
    </TouchableOpacity>
  );
}

// Parts of the day, in the order customers usually look for them. Night
// (22–06) is last and folded away — the salon is bookable around the clock,
// but few people want 03:00.
const PERIODS = [
  { key: 'morning', label: 'Aamu', icon: 'partly-sunny-outline', from: 6, to: 12 },
  { key: 'afternoon', label: 'Iltapäivä', icon: 'sunny-outline', from: 12, to: 17 },
  { key: 'evening', label: 'Ilta', icon: 'cloudy-night-outline', from: 17, to: 22 },
] as const;

const hourOf = (time: string) => Number(time.slice(0, 2));
const isNight = (time: string) => hourOf(time) >= 22 || hourOf(time) < 6;

export default function TimeSlotPicker({
  saloonId,
  serviceId,
  onConfirm,
  showConfirmButton = true,
  onSelectionChange,
}: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dates = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  }), [today]);

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showNight, setShowNight] = useState(false);

  // Use the LOCAL calendar date, not the UTC date. toISOString() shifts to UTC,
  // which in UTC+ timezones (e.g. Finland) rolls "today" back to yesterday.
  const toAPIDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Mirror the selection out to the parent (kept in a ref so an inline arrow
  // prop can't retrigger the effect on every render).
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  useEffect(() => {
    onSelectionChangeRef.current?.(selectedSlot?.datetime ?? null);
  }, [selectedSlot]);

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFailed(false);
      setSelectedSlot(null);
      setSlots([]);
      setShowNight(false);
      try {
        const url =
          `${API_BASE_URL}/public/saloons/${saloonId}/available-slots` +
          `?serviceId=${serviceId}&date=${toAPIDate(selectedDate)}` +
          // Lets the API build the day in the customer's timezone, not the server's.
          `&tz=${selectedDate.getTimezoneOffset()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setSlots(data.availableSlots ?? []);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDate, saloonId, serviceId, reloadKey]);

  const groups = useMemo(() => [
    ...PERIODS.map(p => ({
      key: p.key as string,
      label: p.label as string,
      icon: p.icon as React.ComponentProps<typeof Ionicons>['name'],
      slots: slots.filter(s => hourOf(s.time) >= p.from && hourOf(s.time) < p.to),
    })),
    { key: 'night', label: 'Yö', icon: 'moon-outline' as const, slots: slots.filter(s => isNight(s.time)) },
  ].filter(g => g.slots.length > 0), [slots]);

  const daytimeCount = groups.filter(g => g.key !== 'night').reduce((n, g) => n + g.slots.length, 0);
  const selectedLabel = capitalise(selectedDate.toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long' }));

  return (
    <View>
      {/* Date strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        style={{ marginHorizontal: -2, flexGrow: 0 }}
      >
        {dates.map((d, i) => {
          const isSelected = toAPIDate(d) === toAPIDate(selectedDate);
          const weekday = i === 0 ? 'Tänään' : capitalise(d.toLocaleDateString('fi-FI', { weekday: 'short' }));
          const showMonth = i === 0 || d.getDate() === 1;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedDate(d)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={d.toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long' })}
              style={{
                width: 60,
                paddingVertical: 10,
                borderRadius: 20,
                alignItems: 'center',
                backgroundColor: isSelected ? darkBrown : white,
                borderWidth: 1,
                borderColor: isSelected ? darkBrown : '#E8D9C8',
              }}
            >
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 12, color: isSelected ? beige : muted }}>{weekday}</Text>
              <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 21, color: isSelected ? white : darkBrown, marginTop: 1 }}>
                {d.getDate()}
              </Text>
              <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 11, color: isSelected ? beige : muted, opacity: showMonth || isSelected ? 1 : 0 }}>
                {d.toLocaleDateString('fi-FI', { month: 'short' }).replace('.', '')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: darkBrown, marginTop: 18, marginBottom: 4 }}>
        {selectedLabel}
      </Text>

      {/* Times */}
      {loading ? (
        <View style={{ paddingVertical: 36, alignItems: 'center' }}>
          <ActivityIndicator color={darkBrown} />
        </View>
      ) : failed ? (
        <Notice
          icon="cloud-offline-outline"
          title="Aikoja ei voitu ladata"
          body="Tarkista yhteys ja yritä uudelleen."
          action={{ label: 'Yritä uudelleen', onPress: () => setReloadKey(k => k + 1) }}
        />
      ) : slots.length === 0 ? (
        <Notice
          icon="calendar-clear-outline"
          title="Täyteen varattu"
          body="Tälle päivälle ei ole vapaita aikoja — kokeile toista päivää."
          action={{ label: 'Seuraava päivä', onPress: () => {
            const idx = dates.findIndex(d => toAPIDate(d) === toAPIDate(selectedDate));
            if (idx >= 0 && idx < dates.length - 1) setSelectedDate(dates[idx + 1]);
          } }}
        />
      ) : (
        <View>
          {groups.map(group => {
            const folded = group.key === 'night' && !showNight && daytimeCount > 0;
            return (
              <View key={group.key} style={{ marginTop: 16 }}>
                <TouchableOpacity
                  disabled={group.key !== 'night' || daytimeCount === 0}
                  onPress={() => setShowNight(v => !v)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}
                >
                  <Ionicons name={group.icon} size={16} color={muted} />
                  <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: muted }}>{group.label}</Text>
                  <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: muted }}>· {group.slots.length}</Text>
                  {group.key === 'night' && daytimeCount > 0 && (
                    <Ionicons name={folded ? 'chevron-down' : 'chevron-up'} size={15} color={muted} style={{ marginLeft: 2 }} />
                  )}
                </TouchableOpacity>

                {!folded && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {group.slots.map(slot => {
                      const isSelected = selectedSlot?.datetime === slot.datetime;
                      return (
                        <TouchableOpacity
                          key={slot.datetime}
                          onPress={() => setSelectedSlot(isSelected ? null : slot)}
                          // activeOpacity 1: the default dim could stick after the
                          // re-render, leaving the chosen time washed out.
                          activeOpacity={1}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          style={{
                            width: '23%',
                            flexGrow: 1,
                            maxWidth: '23.5%',
                            height: 44,
                            borderRadius: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isSelected ? darkBrown : white,
                            borderWidth: 1,
                            borderColor: isSelected ? darkBrown : '#E8D9C8',
                          }}
                        >
                          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: isSelected ? white : darkBrown }}>
                            {slot.time}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Confirm button — skipped when the parent pins it to the screen bottom */}
      {showConfirmButton && (
        <View style={{ marginTop: 20 }}>
          <ConfirmBookingTimeButton
            enabled={!!selectedSlot}
            selected={selectedSlot?.datetime}
            onPress={() => selectedSlot && onConfirm(selectedSlot.datetime)}
          />
        </View>
      )}
    </View>
  );
}

function Notice({
  icon, title, body, action,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, marginTop: 12, borderRadius: 20, backgroundColor: lightBeige }}>
      <Ionicons name={icon} size={26} color={darkBrown} />
      <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 16, color: darkBrown, marginTop: 8 }}>{title}</Text>
      <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: muted, marginTop: 2, textAlign: 'center' }}>{body}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress} style={{ marginTop: 12, paddingHorizontal: 16, height: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: white }}>
          <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: darkBrown }}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
