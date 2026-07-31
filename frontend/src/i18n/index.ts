import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import elHome from "../locales/el/home.json";
import enHome from "../locales/en/home.json";
import elSubscription from "../locales/el/subscription.json";
import enSubscription from "../locales/en/subscription.json";
import { normalizeAppLang, readStoredAppLang } from "../lib/appLang";

export const HOME_I18N_STORAGE_KEY = "hm_pre_lang";

/** Locales with a complete landing-page i18next JSON bundle. */
export const HOME_LOCALES = ["el", "en"] as const;
export type HomeLocale = (typeof HOME_LOCALES)[number];

export function isHomeLocale(lang: string): lang is HomeLocale {
  return (HOME_LOCALES as readonly string[]).includes(normalizeAppLang(lang));
}

/** i18next display language for home/subscription (JSON only el/en). */
export function homeDisplayLocale(stored: string): HomeLocale {
  const code = normalizeAppLang(stored, "el");
  return code === "el" ? "el" : "en";
}

const initialStored = readStoredAppLang("el");
const initialLang = homeDisplayLocale(initialStored);

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
