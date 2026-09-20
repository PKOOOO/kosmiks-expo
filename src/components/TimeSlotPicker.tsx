import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { API_BASE_URL } from '@/config/constants';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const lightBeige = '#F4EDE5';
const white = '#FFFFFF';

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

/**
 * The confirm action, exported so a parent can pin it to the bottom of the
 * screen (outside the ScrollView) while the picker itself stays scrollable.
 */
export function ConfirmBookingTimeButton({
  enabled,
  onPress,
}: {
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!enabled}
      activeOpacity={0.85}
      style={{
        backgroundColor: enabled ? darkBrown : lightBeige,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: enabled ? darkBrown : beige,
      }}
    >
      <Text
        style={{
          fontFamily: 'Philosopher-Bold',
          fontSize: 16,
          color: enabled ? white : '#aaa',
        }}
      >
        Confirm booking time
      </Text>
    </TouchableOpacity>
  );
}

export default function TimeSlotPicker({
  saloonId,
  serviceId,
  onConfirm,
  showConfirmButton = true,
  onSelectionChange,
}: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  // Use the LOCAL calendar date, not the UTC date. toISOString() shifts to UTC,
  // which in UTC+ timezones (e.g. Finland) rolls "today" back to yesterday and
  // makes the API return an all-past day → "no available slots".
  const toAPIDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const toDisplayDate = (d: Date) =>
    d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' });

  // Mirror the selection out to the parent (kept in a ref so an inline arrow
  // prop can't retrigger the effect on every render).
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  useEffect(() => {
    onSelectionChangeRef.current?.(selectedSlot?.datetime ?? null);
  }, [selectedSlot]);

  useEffect(() => {
    let cancelled = false;

    const fetchSlots = async () => {
      setLoading(true);
      setSelectedSlot(null);
      setIsClosed(false);
      setSlots([]);
      try {
        const url =
          `${API_BASE_URL}/public/saloons/${saloonId}/available-slots` +
          `?serviceId=${serviceId}&date=${toAPIDate(selectedDate)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        if (data.isClosed) {
          setIsClosed(true);
        } else {
          setSlots(data.availableSlots ?? []);
        }
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSlots();
    return () => { cancelled = true; };
  }, [selectedDate, saloonId, serviceId]);

  return (
    <View>
      {/* Date pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 4 }}
        style={{ marginBottom: 16 }}
      >
        {dates.map((d, i) => {
          const isSelected = toAPIDate(d) === toAPIDate(selectedDate);
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedDate(d)}
              activeOpacity={1}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                marginRight: 8,
                backgroundColor: isSelected ? darkBrown : white,
                borderWidth: 1.5,
                borderColor: isSelected ? darkBrown : beige,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Philosopher-Bold',
                  fontSize: 13,
                  color: isSelected ? white : darkBrown,
                }}
              >
                {toDisplayDate(d)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Slot grid */}
      {loading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: '47%',
                height: 46,
                borderRadius: 10,
                backgroundColor: beige,
                opacity: 0.35,
              }}
            />
          ))}
        </View>
      ) : isClosed ? (
        <View style={{ paddingVertical: 28, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: 'Philosopher-Bold',
              fontSize: 15,
              color: '#c00',
              marginBottom: 4,
            }}
          >
            Closed on this day
          </Text>
          <Text
            style={{
              fontFamily: 'Philosopher-Regular',
              fontSize: 13,
              color: '#888',
            }}
          >
            Please select another date
          </Text>
        </View>
      ) : slots.length === 0 ? (
        <View style={{ paddingVertical: 28, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: 'Philosopher-Regular',
              fontSize: 14,
              color: '#888',
            }}
          >
            No available slots for this date
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {slots.map((slot) => {
            const isSelected = selectedSlot?.datetime === slot.datetime;
            return (
              <TouchableOpacity
                key={slot.datetime}
                onPress={() => setSelectedSlot(slot)}
                // activeOpacity 1 disables the press-dim animation. The default
                // 0.2 could be left applied when the press triggered a
                // re-render, so the chosen slot stayed washed out instead of
                // showing solid brown.
                activeOpacity={1}
                style={{
                  width: '47%',
                  paddingVertical: 13,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: isSelected ? darkBrown : white,
                  borderWidth: 1.5,
                  borderColor: isSelected ? darkBrown : beige,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Philosopher-Bold',
                    fontSize: 15,
                    color: isSelected ? white : darkBrown,
                  }}
                >
                  {slot.time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Confirm button — skipped when the parent pins it to the screen bottom */}
      {showConfirmButton && (
        <View style={{ marginTop: 20 }}>
          <ConfirmBookingTimeButton
            enabled={!!selectedSlot}
            onPress={() => selectedSlot && onConfirm(selectedSlot.datetime)}
          />
        </View>
      )}
    </View>
  );
}
