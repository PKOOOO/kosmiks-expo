/**
 * App translations. Finnish is the default and the source of truth (`fi.ts`);
 * `en.ts` must have exactly the same keys (TypeScript enforces it).
 *
 *   const { t, lang } = useT();         // in components — re-renders on switch
 *   t('booking.title')                  // plain text
 *   t('booking.paidAt', { time: '14:00' })  // "{time}" placeholders
 *   tr('common.retry')                  // outside components (helpers)
 *
 * Content from the database (salon names, descriptions, service and category
 * names) is not translated — it is shown as the salon wrote it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import fi from './fi';
import en from './en';

export type Lang = 'fi' | 'en';
export const LANGUAGES: { code: Lang; name: string }[] = [
  { code: 'fi', name: 'Suomi' },
  { code: 'en', name: 'English' },
];
export const DEFAULT_LANG: Lang = 'fi';
const STORAGE_KEY = '@kosmiks_language';

const dictionaries = { fi, en } as const;

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Leaves<typeof fi>;
export type TParams = Record<string, string | number | null | undefined>;

function lookup(dict: unknown, key: string): string | undefined {
  let node: any = dict;
  for (const part of key.split('.')) {
    node = node?.[part];
    if (node === undefined) return undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

export function translate(lang: Lang, key: TKey, params?: TParams): string {
  const text = lookup(dictionaries[lang], key) ?? lookup(dictionaries.fi, key) ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined || params[name] === null ? match : String(params[name]),
  );
}

type LanguageState = { lang: Lang; loaded: boolean; setLang: (lang: Lang) => void };

export const useLanguage = create<LanguageState>((set) => ({
  lang: DEFAULT_LANG,
  loaded: false,
  setLang: (lang) => {
    set({ lang });
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  },
}));

/** Read the saved language once at startup (the root layout waits for it). */
export async function loadLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'fi' || saved === 'en') useLanguage.setState({ lang: saved });
  } catch {
    /* keep the default */
  }
  useLanguage.setState({ loaded: true });
}

/** Translate outside React components (uses the current language). */
export function tr(key: TKey, params?: TParams): string {
  return translate(useLanguage.getState().lang, key, params);
}

/** BCP 47 tag for dates and numbers in the current language. */
export function localeTag(lang: Lang = useLanguage.getState().lang): string {
  return lang === 'en' ? 'en-GB' : 'fi-FI';
}

export function useT() {
  const lang = useLanguage((s) => s.lang);
  const t = (key: TKey, params?: TParams) => translate(lang, key, params);
  return { t, lang, locale: localeTag(lang) };
}

/** Label for a service variant code from the catalog (UUDET, PITKAT, …), or undefined if unknown. */
export function workTypeLabel(code: string): string | undefined {
  const key = `workType.${code}`;
  const text = tr(key as TKey);
  return text === key ? undefined : text;
}

/**
 * Navigation value meaning "every service of the salon" (map → /services).
 * A fixed value, not shown to users — screens translate it when displaying.
 */
export const ALL_SERVICES = 'Kaikki palvelut';

/** "25,00 €" in Finnish, "€25.00" in English. */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat(localeTag(), { style: 'currency', currency: 'EUR' }).format(amount);
}
