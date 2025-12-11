import en from '../../_locales/en/messages.json';
import zh from '../../_locales/zh/messages.json';

export type Locale = 'en' | 'zh';

const MESSAGES: Record<Locale, Record<string, { message: string }>> = { en, zh };
const LOCALE_STORAGE_KEY = 'gptExporterLocale';
export const DEFAULT_LOCALE: Locale = 'zh';

let cachedLocale: Locale = DEFAULT_LOCALE;

export function resolveLocale(value?: string | null): Locale {
  return value === 'en' || value === 'zh' ? value : DEFAULT_LOCALE;
}

export async function loadLocale(): Promise<Locale> {
  try {
    const stored =
      (await browser?.storage?.sync?.get(LOCALE_STORAGE_KEY)) ??
      (await browser?.storage?.local?.get(LOCALE_STORAGE_KEY));
    const next = resolveLocale(stored?.[LOCALE_STORAGE_KEY]);
    cachedLocale = next;
    return next;
  } catch (error) {
    console.warn('[GPT Exporter] Failed to load locale', error);
    cachedLocale = DEFAULT_LOCALE;
    return DEFAULT_LOCALE;
  }
}

export async function saveLocale(locale: Locale) {
  cachedLocale = locale;
  await browser?.storage?.sync?.set({ [LOCALE_STORAGE_KEY]: locale });
}

export function setLocaleCache(locale: Locale) {
  cachedLocale = locale;
}

export function getCachedLocale(): Locale {
  return cachedLocale;
}

export function t(key: string, locale?: Locale) {
  const lang = locale || cachedLocale || DEFAULT_LOCALE;
  return MESSAGES[lang]?.[key]?.message ?? key;
}

export const LOCALE_KEY = LOCALE_STORAGE_KEY;
