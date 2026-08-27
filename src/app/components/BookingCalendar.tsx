// src/app/components/BookingCalendar.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/config/constants';

const { width } = Dimensions.get('window');

// Theme colors matching the app
const darkBrown = "#3C2C1E";
const lightBeige = "#F5F1EB";
const accentGold = "#3C2C1E"; // Changed from gold to dark brown to match app theme
const lightGold = "#F4E4BC";

interface BookingCalendarProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedDate: string, selectedTime: string) => void;
  salonName: string;
  saloonId?: string;
  serviceId?: string;
}

const BookingCalendar: React.FC<BookingCalendarProps> = ({
  visible,
  onClose,
  onConfirm,
  salonName,
  saloonId,
  serviceId
}) => {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // Outer container padding (20) + calendar box padding (16) + border (2) on each side
  const OUTER_PADDING = 20;
  const CALENDAR_PADDING = 16;
  const BORDER_WIDTH = 2;
  const DAY_GAP = 4;
  const calendarGridWidth = width - (OUTER_PADDING * 2) - (CALENDAR_PADDING * 2) - (BORDER_WIDTH * 2);
  const dayCellWidth = (calendarGridWidth - (DAY_GAP * 6)) / 7;
  const [availabilityData, setAvailabilityData] = useState<{ [date: string]: string[] }>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  // Fetch available slots from backend
  const fetchAvailableSlots = async (date: string) => {
    if (!saloonId || !serviceId) {
      console.log('Missing required props for fetching slots');
      return;
    }

    try {
      setLoading(true);
      const url = `${API_BASE_URL}/public/saloons/${saloonId}/available-slots?serviceId=${serviceId}&date=${date}`;
      console.log('Fetching available slots from:', url);
      console.log('Parameters:', { saloonId, serviceId, date });

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        console.log('Available slots response:', data);

        // Check if the saloon is closed on this day
        if (data.isClosed) {
          console.log('Saloon is closed on this day:', data.message);
          setAvailableSlots([]);
          setIsClosed(true);
          return;
        }

        // Reset closed state if saloon is open
        setIsClosed(false);

        const slots = data.availableSlots.map((slot: any) => slot.time);
        console.log('Available time slots:', slots);
        setAvailableSlots(slots);
      } else {
        console.log('Failed to fetch available slots:', response.status, response.statusText);
        setAvailableSlots([]);
        setIsClosed(false);
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
      setAvailableSlots([]);
      setIsClosed(false);
    } finally {
      setLoading(false);
    }
  };

  // Fetch slots when date is selected
  useEffect(() => {
    if (selectedDate && saloonId && serviceId) {
      fetchAvailableSlots(selectedDate);
    } else {
      setAvailableSlots([]);
    }
  }, [selectedDate, saloonId, serviceId]);

  // Generate dates: until the end of the month, but at least 14 days
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    // Calculate last day of current month
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const daysRemainingInMonth = lastDayOfMonth - today.getDate();

    // Show at least 14 days, or until the end of the month if it's further away
    const daysToShow = Math.max(14, daysRemainingInMonth + 1);

    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  // Use available slots from API - these are dynamically generated based on service duration
  const allTimeSlots = availableSlots;

  const formatDate = (date: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return {
      day: days[date.getDay()],
      date: date.getDate(),
      month: months[date.getMonth()],
      full: date.toISOString().split('T')[0]
    };
  };

  const getMonthLabel = (date: Date) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getCalendarGrid = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Calculate how many rows we actually need
    const totalCells = startDay + daysInMonth;
    const rowsNeeded = Math.ceil(totalCells / 7);
    const cellsNeeded = rowsNeeded * 7;
    
    const days: (Date | null)[] = [];
    for (let i = 0; i < cellsNeeded; i++) {
      const dayNum = i - startDay + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        days.push(null);
      } else {
        days.push(new Date(year, month, dayNum));
      }
    }
    return days;
  };

  const handleClose = () => {
    // Reset selections when closing
    setSelectedDate('');
    setSelectedTime('');
    setShowFullCalendar(false);
    onClose();
  };

  const handleConfirm = () => {
    if (selectedDate && selectedTime) {
      onConfirm(selectedDate, selectedTime);
      // Reset and close the modal after confirming
      setSelectedDate('');
      setSelectedTime('');
      setShowFullCalendar(false);
      onClose();
    }
  };

  const isTimeSlotAvailable = (time: string) => {
    // Check if the time slot is in the available slots from backend
    return availableSlots.includes(time);
  };

  const isDateAvailable = (date: Date) => {
    // For now, we'll consider all dates as potentially available
    // In a real implementation, you'd check if the date has any available slots
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: lightBeige }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 26,
          paddingTop: Math.max(16, insets.top + -10),
          borderBottomWidth: 1,
          borderBottomColor: '#E5DCC8',
          backgroundColor: 'white'
        }}>
          <TouchableOpacity onPress={handleClose} style={{ top: Math.max(0, insets.top - 60) }}>
            <Ionicons name="close" size={40} color={darkBrown} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', paddingTop: Math.max(0, insets.top - 100) }}>
            <Text style={{
              fontSize: 18,
              fontFamily: 'Philosopher-Bold',
              color: darkBrown
            }}>
              Ajoittaa
            </Text>
            <Text style={{
              fontSize: 14,
              fontFamily: 'Philosopher-Regular',
              color: darkBrown,
              opacity: 0.7
            }}>
              {salonName}
            </Text>
          </View>

          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={{ flex: 1 }}>
          {/* Date Selection - hide when time slots are showing */}
          {(!selectedDate || showFullCalendar) && (
          <View style={{ padding: 20 }}>
            <Text style={{
              fontSize: 20,
              fontFamily: 'Philosopher-Bold',
              color: darkBrown,
              marginBottom: 16
            }}>
              Valitse Päivämäärä
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 20 }}
            >
              {generateDates().map((date, index) => {
                const formatted = formatDate(date);
                const isSelected = selectedDate === formatted.full;
                const isToday = index === 0;
                const isAvailable = isDateAvailable(date);

                return (
                  <TouchableOpacity
                    key={formatted.full}
                    onPress={() => isAvailable && setSelectedDate(formatted.full)}
                    disabled={!isAvailable}
                    activeOpacity={0.8}
                    style={{
                      width: 80,
                      height: 90,
                      marginRight: 12,
                      borderRadius: 16,
                      backgroundColor: isSelected ? accentGold : isAvailable ? 'white' : '#F0F0F0',
                      borderWidth: 2,
                      borderColor: isSelected ? accentGold : isAvailable ? '#E5DCC8' : '#D0D0D0',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 3,
                      opacity: isAvailable ? 1 : 0.4
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontFamily: 'Philosopher-Regular',
                      color: isSelected ? 'white' : isAvailable ? darkBrown : '#999',
                      opacity: 0.7
                    }}>
                      {formatted.day}
                    </Text>
                    <Text style={{
                      fontSize: 20,
                      fontFamily: 'Philosopher-Bold',
                      color: isSelected ? 'white' : isAvailable ? darkBrown : '#999',
                      marginVertical: 2
                    }}>
                      {formatted.date}
                    </Text>
                    <Text style={{
                      fontSize: 10,
                      fontFamily: 'Philosopher-Regular',
                      color: isSelected ? 'white' : isAvailable ? darkBrown : '#999',
                      opacity: 0.7
                    }}>
                      {formatted.month}
                    </Text>
                    {isToday && (
                      <View style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: isSelected ? 'white' : isAvailable ? accentGold : '#999'
                      }} />
                    )}
                    {!isAvailable && (
                      <View style={{
                        position: 'absolute',
                        top: 2,
                        left: 2,
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#FF6B6B'
                      }} />
                    )}
                  </TouchableOpacity>
                );
              })}
              {/* Plus box to open full calendar */}
              <TouchableOpacity
                onPress={() => setShowFullCalendar((prev) => !prev)}
                activeOpacity={0.8}
                style={{
                  width: 80,
                  height: 90,
                  marginRight: 12,
                  borderRadius: 16,
                  backgroundColor: 'white',
                  borderWidth: 2,
                  borderColor: '#E5DCC8',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3
                }}
              >
                <Ionicons name="add" size={28} color={darkBrown} />
              </TouchableOpacity>
            </ScrollView>

            {/* Full calendar view */}
            {showFullCalendar && (
              <View
                style={{
                  borderWidth: 2,
                  borderColor: '#E5DCC8',
                  borderRadius: 16,
                  backgroundColor: 'white',
                  padding: CALENDAR_PADDING,
                  marginBottom: 10
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      const prev = new Date(calendarMonth);
                      prev.setMonth(prev.getMonth() - 1);
                      setCalendarMonth(prev);
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#E5DCC8',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Ionicons name="chevron-back" size={18} color={darkBrown} />
                  </TouchableOpacity>

                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: 'Philosopher-Bold',
                      color: darkBrown
                    }}
                  >
                    {getMonthLabel(calendarMonth)}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      const next = new Date(calendarMonth);
                      next.setMonth(next.getMonth() + 1);
                      setCalendarMonth(next);
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#E5DCC8',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Ionicons name="chevron-forward" size={18} color={darkBrown} />
                  </TouchableOpacity>
                </View>

                {/* Weekday headers */}
                <View style={{ flexDirection: 'row', width: calendarGridWidth, marginBottom: 8 }}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <Text
                      key={`${d}-${i}`}
                      style={{
                        width: dayCellWidth,
                        marginRight: i === 6 ? 0 : DAY_GAP,
                        textAlign: 'center',
                        fontSize: 12,
                        fontFamily: 'Philosopher-Bold',
                        color: darkBrown,
                        opacity: 0.7
                      }}
                    >
                      {d}
                    </Text>
                  ))}
                </View>

                {/* Calendar grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: calendarGridWidth }}>
                  {(() => {
                    const grid = getCalendarGrid(calendarMonth);
                    const totalRows = Math.ceil(grid.length / 7);
                    
                    return grid.map((date, idx) => {
                      const currentRow = Math.floor(idx / 7);
                      const isLastRow = currentRow === totalRows - 1;
                      
                      if (!date) {
                        return (
                          <View
                            key={`empty-${idx}`}
                            style={{
                              width: dayCellWidth,
                              height: 44,
                              marginBottom: isLastRow ? 0 : 8,
                              marginRight: (idx % 7) === 6 ? 0 : DAY_GAP
                            }}
                          />
                        );
                      }

                      const formatted = formatDate(date);
                      const isSelected = selectedDate === formatted.full;
                      const isAvailable = isDateAvailable(date);

                      return (
                        <TouchableOpacity
                          key={formatted.full}
                          onPress={() => {
                            if (isAvailable) {
                              setSelectedDate(formatted.full);
                              setShowFullCalendar(false);
                            }
                          }}
                          activeOpacity={0.8}
                          disabled={!isAvailable}
                          style={{
                            width: dayCellWidth,
                            height: 44,
                            marginBottom: isLastRow ? 0 : 8,
                            marginRight: (idx % 7) === 6 ? 0 : DAY_GAP,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 10,
                            borderWidth: 2,
                            borderColor: isSelected ? accentGold : '#E5DCC8',
                            backgroundColor: isSelected ? accentGold : 'white',
                            opacity: isAvailable ? 1 : 0.4
                          }}
                        >
                        <Text
                          style={{
                            fontSize: 14,
                            fontFamily: 'Philosopher-Bold',
                            color: isSelected ? 'white' : darkBrown
                          }}
                        >
                          {formatted.date}
                        </Text>
                      </TouchableOpacity>
                      );
                    });
                  })()}
                </View>
              </View>
            )}
          </View>
          )}

          {/* Time Selection - only show when date is selected AND full calendar is closed */}
          {selectedDate && !showFullCalendar && (
            <View style={{ padding: 20, paddingTop: 0 }}>
              <Text style={{
                fontSize: 20,
                fontFamily: 'Philosopher-Bold',
                color: darkBrown,
                marginTop: 16,
                marginBottom: 16
              }}>
                Valitse Aika
              </Text>

              {loading ? (
                <View style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingVertical: 40
                }}>
                  <Text style={{
                    fontSize: 16,
                    fontFamily: 'Philosopher-Regular',
                    color: darkBrown,
                    opacity: 0.7
                  }}>
                    Ladataan vapaat ajat...
                  </Text>
                </View>
              ) : isClosed ? (
                <View style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingVertical: 40
                }}>
                  <Text style={{
                    fontSize: 18,
                    fontFamily: 'Philosopher-Bold',
                    color: '#E53E3E',
                    textAlign: 'center'
                  }}>
                    We are closed on this day
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    fontFamily: 'Philosopher-Regular',
                    color: '#666',
                    textAlign: 'center',
                    marginTop: 8
                  }}>
                    Please select another date
                  </Text>
                </View>
              ) : (
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  {allTimeSlots.map((time) => {
                    // All slots from API are available (they're pre-filtered)
                    const isAvailable = true;
                    const isSelected = selectedTime === time;

                    return (
                      <TouchableOpacity
                        key={time}
                        onPress={() => isAvailable && setSelectedTime(time)}
                        disabled={!isAvailable}
                        activeOpacity={0.8}
                        style={{
                          width: (width - 80) / 3,
                          height: 50,
                          borderRadius: 12,
                          backgroundColor: isSelected
                            ? accentGold
                            : isAvailable
                              ? 'white'
                              : '#F0F0F0',
                          borderWidth: 2,
                          borderColor: isSelected
                            ? accentGold
                            : isAvailable
                              ? '#E5DCC8'
                              : '#D0D0D0',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: isAvailable ? 1 : 0.4
                        }}
                      >
                        <Text style={{
                          fontSize: 16,
                          fontFamily: 'Philosopher-Bold',
                          color: isSelected
                            ? 'white'
                            : isAvailable
                              ? darkBrown
                              : '#999'
                        }}>
                          {time}
                        </Text>
                        {!isAvailable && (
                          <View style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: '#FF6B6B'
                          }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Confirm Button */}
        <View style={{
          padding: 20,
          paddingBottom: Math.max(30, 20 + insets.bottom + -22),
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E5DCC8'
        }}>
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!selectedDate || !selectedTime}
            activeOpacity={0.8}
            style={{
              backgroundColor: selectedDate && selectedTime ? accentGold : '#D0D0D0',
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 3
            }}
          >
            <Text style={{
              fontSize: 18,
              fontFamily: 'Philosopher-Bold',
              color: selectedDate && selectedTime ? 'white' : '#999'
            }}>
              Vahvista aikataulu
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default BookingCalendar;
