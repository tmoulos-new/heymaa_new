import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import elHome from "../locales/el/home.json";
import enHome from "../locales/en/home.json";
import elSubscription from "../locales/el/subscription.json";
import enSubscription from "../locales/en/subscription.json";

export const HOME_I18N_STORAGE_KEY = "hm_pre_lang";

/** Locales with a complete landing-page translation bundle. */
export const HOME_LOCALES = ["el", "en"] as const;
export type HomeLocale = (typeof HOME_LOCALES)[number];

export function isHomeLocale(lang: string): lang is HomeLocale {
  return (HOME_LOCALES as readonly string[]).includes(lang);
}

function readStoredLang(): string {
  try {
    return localStorage.getItem(HOME_I18N_STORAGE_KEY) || "el";
  } catch {
    return "el";
  }
}

const initialLang = isHomeLocale(readStoredLang()) ? readStoredLang() : "el";

i18n.use(initReactI18next).init({
  resources: {
    el: { home: elHome, subscription: elSubscription },
    en: { home: enHome, subscription: enSubscription },
  },
  lng: initialLang,
  fallbackLng: "el",
  defaultNS: "home",
  ns: ["home", "subscription"],
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;
