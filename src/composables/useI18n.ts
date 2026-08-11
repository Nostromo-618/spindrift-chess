import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { TranslationMap } from "../locales/types";
import { EN } from "../locales/en";
import { LT } from "../locales/lt";

export type Locale = "en" | "lt";

const LOCALE_KEY = "sdc-locale";
const LOCALES: Record<Locale, TranslationMap> = { en: EN, lt: LT };

function loadLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored && stored in LOCALES) return stored as Locale;
  } catch {
    // localStorage unavailable — stick with en
  }
  return "en";
}

function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // ignore
  }
}

const currentLocale = ref<Locale>(loadLocale());

const t = computed<TranslationMap>(() => LOCALES[currentLocale.value]);

export function useI18n(): {
  locale: Ref<Locale>;
  t: ComputedRef<TranslationMap>;
  setLocale: (locale: Locale) => void;
} {
  function setLocale(locale: Locale): void {
    currentLocale.value = locale;
    persistLocale(locale);
  }

  return { locale: currentLocale, t, setLocale };
}

/** Singleton locale ref (non-reactive read for engine-layer / non-Vue modules). */
export function getLocale(): Locale {
  return currentLocale.value;
}

/** Singleton translate function for js/ modules (call after locale changes). */
export function getT(): TranslationMap {
  return LOCALES[currentLocale.value];
}

/** Engine draw reasons are English literals; map them for UI display. */
const DRAW_REASON_KEYS: Record<string, keyof TranslationMap["drawReason"]> = {
  "50-move rule": "fiftyMove",
  "Threefold repetition": "threefold",
  "Insufficient material": "insufficientMaterial",
  "by agreement": "agreement",
};

export function translateDrawReason(reason: string | null | undefined): string {
  const t = getT();
  const key = DRAW_REASON_KEYS[reason || "by agreement"];
  if (key) return t.drawReason[key];
  return reason || t.drawReason.agreement;
}
