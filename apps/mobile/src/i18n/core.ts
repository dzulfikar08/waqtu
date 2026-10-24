// Hermes has no Intl.PluralRules, which i18next needs for plural suffixes. Must load before i18next resolves a plural.
import "intl-pluralrules";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LOCALE, deviceLanguages, LOCALES, resolveLocale, type Locale } from "./locale";
import { en } from "./locales/en";
import { id } from "./locales/id";

export const i18n = i18next.createInstance();
i18n.use(initReactI18next);
void i18n.init({
  resources: { id: { translation: id }, en: { translation: en } },
  supportedLngs: [...LOCALES],
  fallbackLng: DEFAULT_LOCALE,
  lng: resolveLocale({ device: deviceLanguages() }),
  interpolation: { escapeValue: false },
  // Resources are bundled, so init is synchronous: t() works on the first render.
  initAsync: false,
  react: { useSuspense: false },
});

/** Switches the UI language; mounted `useTranslation` consumers re-render. */
export async function applyLocale(locale: Locale): Promise<void> {
  if (i18n.language !== locale) await i18n.changeLanguage(locale);
}
