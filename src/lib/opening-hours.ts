/** One day's opening hours, as stored in saloon_time_slots. */
export type TimeSlot = {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  isOpen: boolean;
};

export type OpeningStatus = {
  open: boolean;
  /** Finnish, e.g. "Avoinna nyt · sulkeutuu 18.00" or "Suljettu · avautuu ti 9.00". */
  label: string;
};

const WEEKDAYS_FI = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Finnish time style: 9.00, 18.30
const formatTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':');
  return `${Number(h)}.${m ?? '00'}`;
};

/**
 * Whether a salon is open at `now` (device local time), and when it closes or
 * next opens. Returns null when the salon has no opening hours set.
 */
export function getOpeningStatus(slots: TimeSlot[] | undefined, now: Date = new Date()): OpeningStatus | null {
  const days = (slots ?? []).filter((s) => s.isOpen && s.startTime && s.endTime);
  if (days.length === 0) return null;

  const today = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const byDay = new Map(days.map((s) => [s.dayOfWeek, s]));

  // Still inside yesterday's hours if they run past midnight.
  const yesterday = byDay.get((today + 6) % 7);
  if (yesterday && toMinutes(yesterday.endTime) < toMinutes(yesterday.startTime) && minutes < toMinutes(yesterday.endTime)) {
    return { open: true, label: `Avoinna nyt · sulkeutuu ${formatTime(yesterday.endTime)}` };
  }

  const slot = byDay.get(today);
  if (slot) {
    const start = toMinutes(slot.startTime);
    const end = toMinutes(slot.endTime);
    const overnight = end < start;
    if (minutes >= start && (overnight || minutes < end)) {
      return { open: true, label: `Avoinna nyt · sulkeutuu ${formatTime(slot.endTime)}` };
    }
    if (minutes < start) {
      return { open: false, label: `Suljettu · avautuu klo ${formatTime(slot.startTime)}` };
    }
  }

  // Next day with hours (within the coming week).
  for (let i = 1; i <= 7; i++) {
    const day = (today + i) % 7;
    const next = byDay.get(day);
    if (next) {
      const when = i === 1 ? 'huomenna' : WEEKDAYS_FI[day];
      return { open: false, label: `Suljettu · avautuu ${when} ${formatTime(next.startTime)}` };
    }
  }
  return { open: false, label: 'Suljettu' };
}
