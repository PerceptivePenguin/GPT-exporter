import en from '../../_locales/en/messages.json';
import zh from '../../_locales/zh/messages.json';

export type Locale = 'en' | 'zh';

const MESSAGES: Record<Locale, Record<string, { message: string }>> = { en, zh };
const LOCALE_STORAGE_KEY = 'gptExporterLocale';
export const DEFAULT_LOCALE: Locale = 'zh';

let cachedLocale: Locale = DEFAULT_LOCALE;

function getStorage() {
  const globalAny = globalThis as any;
  if (globalAny.browser?.storage) return globalAny.browser.storage;
  if (globalAny.chrome?.storage) return globalAny.chrome.storage;
  return null;
}

function readFromLocalStorage(): Locale {
  try {
    return resolveLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

function persistToLocalStorage(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage may be unavailable in some contexts; ignore failures.
  }
}

export function resolveLocale(value?: string | null): Locale {
  return value === 'en' || value === 'zh' ? value : DEFAULT_LOCALE;
}

export async function loadLocale(): Promise<Locale> {
  const storage = getStorage();
  try {
    if (storage) {
      const stored =
        (await storage.sync?.get?.(LOCALE_STORAGE_KEY)) ??
        (await storage.local?.get?.(LOCALE_STORAGE_KEY));
      const next = resolveLocale(stored?.[LOCALE_STORAGE_KEY]);
      cachedLocale = next;
      persistToLocalStorage(next);
      return next;
    }
  } catch (error) {
    console.warn('[GPT Exporter] Failed to load locale', error);
  }
  const fallback = readFromLocalStorage();
  cachedLocale = fallback;
  return fallback;
}

export async function saveLocale(locale: Locale) {
  cachedLocale = locale;
  const storage = getStorage();
  try {
    if (storage?.sync?.set) {
      await storage.sync.set({ [LOCALE_STORAGE_KEY]: locale });
    } else if (storage?.local?.set) {
      await storage.local.set({ [LOCALE_STORAGE_KEY]: locale });
    }
  } catch (error) {
    console.warn('[GPT Exporter] Failed to save locale', error);
  }
  persistToLocalStorage(locale);
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
