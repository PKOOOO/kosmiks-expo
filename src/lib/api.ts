import { API_BASE_URL } from '@/config/constants';
import { tr } from '@/i18n';
import { translateServerMessage } from '@/i18n/server-messages';

/**
 * Shared networking helpers.
 *
 * - `apiFetch` adds a timeout and retries idempotent requests on network
 *   failures, and turns network failures into an `ApiError`.
 * - `ApiError.http(status)` is what actions throw for non-OK responses.
 * - `describeError` turns *any* thrown value into Finnish copy for the UI.
 *   Screens must never render `error.message` directly — it can contain
 *   things like "java.net.UnknownHostException".
 */

export type ApiErrorKind = 'offline' | 'timeout' | 'server' | 'auth' | 'notFound' | 'unknown';

export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, public status?: number, message?: string) {
    super(message ?? kind);
    this.name = 'ApiError';
  }

  static http(status: number) {
    if (status === 401 || status === 403) return new ApiError('auth', status, `HTTP ${status}`);
    if (status === 404) return new ApiError('notFound', status, `HTTP ${status}`);
    if (status >= 500) return new ApiError('server', status, `HTTP ${status}`);
    return new ApiError('unknown', status, `HTTP ${status}`);
  }
}

const ADMIN_API_KEY = process.env.EXPO_PUBLIC_ADMIN_API_KEY || '';

/**
 * Headers for our API: the app's bearer key (lets the request past the
 * middleware; on its own it only grants anonymous/public access) plus the
 * signed-in user's Clerk token when there is one, which identifies them.
 */
export function apiHeaders(userToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (ADMIN_API_KEY) headers.Authorization = `Bearer ${ADMIN_API_KEY}`;
  if (userToken) headers['X-User-Token'] = userToken;
  return headers;
}

const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_DELAYS_MS = [800, 2000];

type ApiFetchOptions = {
  timeoutMs?: number;
  /** Defaults to true for GET/HEAD, false otherwise. Never retry payments. */
  retry?: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function apiFetch(
  input: string,
  init: RequestInit = {},
  { timeoutMs = DEFAULT_TIMEOUT_MS, retry }: ApiFetchOptions = {},
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const canRetry = retry ?? (method === 'GET' || method === 'HEAD');
  const attempts = canRetry ? RETRY_DELAYS_MS.length + 1 : 1;

  let lastError: ApiError = new ApiError('unknown');
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      lastError = controller.signal.aborted
        ? new ApiError('timeout', undefined, 'Request timed out')
        : new ApiError('offline', undefined, error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/** Best-effort classification of anything a screen caught. */
export function classifyError(error: unknown): ApiErrorKind {
  if (error instanceof ApiError) return error.kind;
  const text = error instanceof Error ? error.message : String(error ?? '');
  if (/network request failed|fetch failed|unknownhost|unable to resolve host|failed to connect|timeout|internet/i.test(text)) {
    return 'offline';
  }
  const status = text.match(/\b(\d{3})\b/)?.[1];
  if (status) return ApiError.http(Number(status)).kind;
  return 'unknown';
}

export type ErrorCopy = { title: string; message: string };

export function describeError(error: unknown, isOffline = false): ErrorCopy {
  if (isOffline) {
    return { title: tr('errors.offlineTitle'), message: tr('errors.offlineBody') };
  }
  switch (classifyError(error)) {
    case 'offline':
      return { title: tr('errors.connTitle'), message: tr('errors.connBody') };
    case 'timeout':
      return { title: tr('errors.slowTitle'), message: tr('errors.slowBody') };
    case 'server':
      return { title: tr('errors.serverTitle'), message: tr('errors.serverBody') };
    case 'auth':
      return { title: tr('errors.authTitle'), message: tr('errors.authBody') };
    case 'notFound':
      return { title: tr('errors.notFoundTitle'), message: tr('errors.notFoundBody') };
    default:
      return { title: tr('errors.genericTitle'), message: tr('errors.genericBody') };
  }
}

/**
 * When a request fails but the device says it is online, ask our own health
 * endpoint whether the problem is on our side. Returns true if the server is
 * reachable and healthy.
 */
export async function isServerHealthy(): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/public/health`, {}, { timeoutMs: 5000, retry: false });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Short copy for connection-type failures (provider/admin screens), in the app
 * language. Returns null for other errors so callers can keep showing the
 * server's own validation message.
 */
export function connectionProblem(error: unknown): string | null {
  switch (classifyError(error)) {
    case 'offline':
      return tr('errors.noInternet');
    case 'timeout':
      return tr('errors.slow');
    case 'server':
      return tr('errors.ourSide');
    default:
      return null;
  }
}

/**
 * Error text for the provider and admin screens, in the app language.
 * Connection problems and server errors get friendly copy; a short, plain
 * server message (e.g. "Rejection reason required") is kept because it tells
 * the user what to fix; anything else (HTML pages, stack traces, empty
 * messages) falls back to `fallback`.
 */
export function friendlyError(error: unknown, fallback = tr('errors.generic')): string {
  const connection = connectionProblem(error);
  if (connection) return connection;
  if (error instanceof ApiError) {
    if (error.kind === 'auth') {
      return error.status === 403
        ? tr('errors.noPermission')
        : tr('errors.sessionExpired');
    }
    if (error.kind === 'notFound') return tr('errors.itemNotFound');
  }
  const text = error instanceof Error ? error.message.trim() : '';
  const looksTechnical = !text || text.length > 140 || /^</.test(text) || /^HTTP \d{3}$/.test(text) || /exception|stack|undefined|null/i.test(text);
  return looksTechnical ? fallback : translateServerMessage(text);
}
