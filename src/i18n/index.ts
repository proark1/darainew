// i18n registry. Add a new locale by creating a sibling `xx.ts` and
// registering a loader here. Keep the union in sync with the keys of
// `localeLoaders`.

import en from "./en";

export type Language = "en" | "de";
export type TranslationBundle = Record<string, string>;

export const EN_TRANSLATIONS: TranslationBundle = en;

const localeLoaders: Record<Language, () => Promise<TranslationBundle>> = {
  en: () => Promise.resolve(en),
  de: () => import("./de").then((mod) => mod.default),
};

export const SUPPORTED_LANGUAGES: Language[] = ["en", "de"];

export function loadTranslations(language: Language): Promise<TranslationBundle> {
  return localeLoaders[language]();
}

// Resolve a translation key. Locales fall back to English first; truly unknown
// keys return an empty string so technical translation ids do not leak into UI.
export function translate(messages: TranslationBundle, key: string): string {
  return messages[key] ?? EN_TRANSLATIONS[key] ?? "";
}
