import { create } from 'zustand';
import { API_BASE_URL } from '@/config/constants';

// Shared data + maths for the Earnings tab (overview, payout detail, bank
// account, how-it-works). One fetch serves every page in the stack.

const ADMIN_API_KEY = process.env.EXPO_PUBLIC_ADMIN_API_KEY || '';

/** Where questions about payouts go. */
export const SUPPORT_EMAIL = 'support@kosmiks.com';
/** Payout day, 0 = Sunday … 5 = Friday. */
export const PAYOUT_WEEKDAY = 5;

export type EarningsBooking = {
  id: string;
  totalAmount: number | null;
  status: string;
  bookingTime: string;
  customerName: string | null;
  paymentMethod?: string;
  payoutId?: string | null;
  service: { name: string } | null;
  user: { name: string; email: string } | null;
};

export type PayoutStatus = 'scheduled' | 'sent' | 'arrived' | 'failed';

/** A payout to the provider, as returned by /provider/revenue. */
export type Payout = {
  id: string;
  amount: number;       // what the provider receives
  gross: number;        // bookings total before the fee
  fee: number;
  status: PayoutStatus;
  scheduledFor: string; // ISO date
  sentAt?: string | null;
  arrivedAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  reference?: string | null;
  /** The account this payout was sent to (captured when it was created). */
  iban?: string;
  bookingIds?: string[];
};

export type ServerBalance = {
  available: number;
  availableGross: number;
  availableFee: number;
  availableCount: number;
  upcoming: number;
  upcomingCount: number;
};

export type EarningsData = {
  saloonName: string | null;
  feeRate: number;
  bookings: EarningsBooking[];
  payouts: Payout[];
  /** Server-computed balance (online-paid bookings not yet paid out). */
  balance: ServerBalance | null;
  iban: string | null;
  bankAccountName: string | null;
};

type EarningsState = {
  data: EarningsData | null;
  loading: boolean;
  error: string | null;
  load: (getToken: () => Promise<string | null>) => Promise<void>;
};

export const useEarningsStore = create<EarningsState>((set) => ({
  data: null,
  loading: true,
  error: null,
  load: async (getToken) => {
    set({ error: null });
    try {
      const token = await getToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${ADMIN_API_KEY}` };
      if (token) headers['X-User-Token'] = token;
      const res = await fetch(`${API_BASE_URL}/provider/revenue`, { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      set({
        data: {
          saloonName: json.saloon?.name ?? null,
          feeRate: typeof json.platformFeeRate === 'number' ? json.platformFeeRate : 0.1,
          bookings: Array.isArray(json.bookings) ? json.bookings : [],
          payouts: Array.isArray(json.payouts) ? json.payouts : [],
          balance: json.balance && typeof json.balance.available === 'number' ? json.balance : null,
          iban: json.payout?.iban ?? null,
          bankAccountName: json.payout?.bankAccountName ?? null,
        },
        loading: false,
      });
    } catch {
      set({ error: "Couldn't load your earnings.", loading: false });
    }
  },
}));

// ─── Formatting ──────────────────────────────────────────────────────────────

const eur = new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' });
export const formatEur = (n: number) => eur.format(n);

export const formatDay = (d: Date) =>
  d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export const formatDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatIban = (iban: string) => iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

/** "•••• 78 33" — enough to recognise the account without showing it. */
export const maskIban = (iban: string) => {
  const clean = iban.replace(/\s+/g, '');
  const last4 = clean.slice(-4);
  return `•••• ${last4.slice(0, 2)} ${last4.slice(2)}`;
};

// ─── Maths ───────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;
export const feeOf = (gross: number, rate: number) => round2(gross * rate);
export const netOf = (gross: number, rate: number) => round2(gross - feeOf(gross, rate));

// Unpaid (`pending`) and cancelled bookings aren't revenue.
const counts = (b: EarningsBooking) => b.status !== 'cancelled' && b.status !== 'pending';

/**
 * Available balance and upcoming earnings. Uses the server's numbers, which
 * apply the payout rules (online-paid only, not yet in a payout); the local
 * calculation is only a fallback for an older API.
 */
export function summarise(data: EarningsData, now = new Date()) {
  if (data.balance) {
    return {
      earnedCount: data.balance.availableCount,
      earnedGross: data.balance.availableGross,
      earnedFee: data.balance.availableFee,
      available: data.balance.available,
      upcomingCount: data.balance.upcomingCount,
      upcomingNet: data.balance.upcoming,
    };
  }
  const paidOut = new Set(data.payouts.flatMap(p => p.bookingIds ?? []));
  const earned = data.bookings.filter(b => counts(b) && new Date(b.bookingTime) <= now && !paidOut.has(b.id));
  const upcoming = data.bookings.filter(b => counts(b) && new Date(b.bookingTime) > now);
  const sum = (list: EarningsBooking[]) => round2(list.reduce((s, b) => s + (b.totalAmount ?? 0), 0));
  const earnedGross = sum(earned);
  const upcomingGross = sum(upcoming);
  return {
    earnedCount: earned.length,
    earnedGross,
    earnedFee: feeOf(earnedGross, data.feeRate),
    available: netOf(earnedGross, data.feeRate),
    upcomingCount: upcoming.length,
    upcomingNet: netOf(upcomingGross, data.feeRate),
  };
}

export function nextPayoutDate(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (PAYOUT_WEEKDAY - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export type MonthTotal = { key: string; label: string; revenue: number; count: number };

export function totalsByMonth(bookings: EarningsBooking[]): MonthTotal[] {
  const acc: Record<string, { revenue: number; count: number }> = {};
  for (const b of bookings) {
    if (!counts(b)) continue;
    const key = b.bookingTime.slice(0, 7);
    acc[key] ??= { revenue: 0, count: 0 };
    acc[key].revenue += b.totalAmount ?? 0;
    acc[key].count++;
  }
  return Object.entries(acc)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, { revenue, count }]) => {
      const [y, m] = key.split('-');
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      return { key, label, revenue: round2(revenue), count };
    });
}
