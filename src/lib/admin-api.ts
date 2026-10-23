import { create } from 'zustand';
import { API_BASE_URL } from '@/config/constants';

// Requests for the native admin dashboard, plus the shared admin data that
// drives the tab badges (applications to review, payouts to send).

const ADMIN_API_KEY = process.env.EXPO_PUBLIC_ADMIN_API_KEY || '';

type GetToken = () => Promise<string | null>;

/**
 * The app key gets past the API middleware; the Clerk token identifies the
 * admin (the server checks it first, and payout routes require it).
 */
export async function adminRequest<T = any>(
  getToken: GetToken,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ADMIN_API_KEY}`,
  };
  if (token) headers['X-User-Token'] = token;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const message = (data && typeof data === 'object' && data.error) || (typeof data === 'string' && data) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProviderStatus =
  | 'NOT_APPLIED' | 'PHASE1_PENDING' | 'PHASE1_APPROVED'
  | 'PHASE2_PENDING' | 'PHASE2_APPROVED' | 'ACTIVE' | 'REJECTED';

export type Application = {
  id: string;
  userId: string;
  currentPhase: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  city: string | null;
  neighbourhood: string | null;
  address: string | null;
  serviceCategories: string[];
  legalName: string | null;
  dateOfBirth: string | null;
  bankAccountName: string | null;
  iban: string | null;
  qualificationDocs: string[];
  termsAcceptedAt: string | null;
  adminNotes: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null; email: string; providerStatus: ProviderStatus };
};

export type AdminPayout = {
  id: string;
  userId: string;
  saloonId: string;
  gross: number;
  fee: number;
  amount: number;
  status: 'scheduled' | 'sent' | 'arrived' | 'failed';
  scheduledFor: string;
  sentAt: string | null;
  arrivedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  reference: string | null;
  iban: string;
  bankAccountName: string | null;
  user: { id: string; name: string | null; email: string };
  _count: { bookings: number };
};

export const isAwaitingReview = (s: ProviderStatus) => s === 'PHASE1_PENDING' || s === 'PHASE2_PENDING';

export const applicantName = (a: Application) =>
  [a.firstName, a.lastName].filter(Boolean).join(' ') || a.user.name || a.user.email;

// ─── Store ───────────────────────────────────────────────────────────────────

type AdminState = {
  applications: Application[];
  payouts: AdminPayout[];
  applicationsLoaded: boolean;
  payoutsLoaded: boolean;
  loadApplications: (getToken: GetToken) => Promise<void>;
  loadPayouts: (getToken: GetToken) => Promise<void>;
};

export const useAdminStore = create<AdminState>((set) => ({
  applications: [],
  payouts: [],
  applicationsLoaded: false,
  payoutsLoaded: false,
  loadApplications: async (getToken) => {
    try {
      const data = await adminRequest(getToken, '/admin/applications');
      set({ applications: Array.isArray(data?.applications) ? data.applications : [], applicationsLoaded: true });
    } catch (e) {
      set({ applicationsLoaded: true });
      throw e;
    }
  },
  loadPayouts: async (getToken) => {
    try {
      const data = await adminRequest(getToken, '/admin/payouts');
      set({ payouts: Array.isArray(data) ? data : [], payoutsLoaded: true });
    } catch (e) {
      set({ payoutsLoaded: true });
      throw e;
    }
  },
}));

/** Badge counts for the admin tabs. */
export const useAdminBadges = () => {
  const reviewCount = useAdminStore(s => s.applications.filter(a => isAwaitingReview(a.user.providerStatus)).length);
  const toSendCount = useAdminStore(s => s.payouts.filter(p => p.status === 'scheduled').length);
  return { reviewCount, toSendCount };
};
