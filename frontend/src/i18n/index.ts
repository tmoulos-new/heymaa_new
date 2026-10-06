import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import elHome from "../locales/el/home.json";
import enHome from "../locales/en/home.json";
import roHome from "../locales/ro/home.json";
import elFaq from "../locales/el/faq.json";
import enFaq from "../locales/en/faq.json";
import roFaq from "../locales/ro/faq.json";
import elSubscription from "../locales/el/subscription.json";
import enSubscription from "../locales/en/subscription.json";
import roSubscription from "../locales/ro/subscription.json";
import elLegal from "../locales/el/legal.json";
import enLegal from "../locales/en/legal.json";
import roLegal from "../locales/ro/legal.json";
import legalShell from "../locales/legalShell.json";
import { normalizeAppLang, readStoredAppLang } from "../lib/appLang";
import { LEGAL_UI_LANGS, legalDocumentLang, legalUiLang } from "../lib/legalLocale";
import {
  buildLegacyHomeBundle,
  hasLegacyHomeBundle,
  LEGACY_HOME_LANGS,
} from "./homeLegacyBundles";

export const HOME_I18N_STORAGE_KEY = "hm_pre_lang";

/** Locales with the primary JSON landing / app marketing bundles. */
export const HOME_JSON_LOCALES = ["el", "en", "ro"] as const;
export type HomeJsonLocale = (typeof HOME_JSON_LOCALES)[number];

const HOME_JSON_LOCALE_SET = new Set<string>(HOME_JSON_LOCALES);

/** @deprecated Use HOME_JSON_LOCALES — kept for callers that only need primary JSON. */
export const HOME_LOCALES = HOME_JSON_LOCALES;
export type HomeLocale = HomeJsonLocale | (typeof LEGACY_HOME_LANGS)[number];

export function isHomeLocale(lang: string): lang is HomeLocale {
  const code = normalizeAppLang(lang);
  return HOME_JSON_LOCALE_SET.has(code) || hasLegacyHomeBundle(code);
}

/** i18next language for the landing page: primary JSON, or legacy bundle for other langs. */
export function homeDisplayLocale(stored: string): string {
  const code = normalizeAppLang(stored, "el");
  if (HOME_JSON_LOCALE_SET.has(code)) return code;
  if (hasLegacyHomeBundle(code)) return code;
  return "en";
}

export { legalDocumentLang, legalUiLang };

type LegalShellEntry = {
  cookie: Partial<(typeof enLegal)["cookie"]> &
    Pick<(typeof enLegal)["cookie"], "title" | "body" | "privacyLink" | "accept" | "reject">
  shell: (typeof enLegal)["shell"]
}

function legalBundleForUiLang(code: string): typeof enLegal {
  if (code === "el") return elLegal
  if (code === "en") return enLegal
  if (code === "ro") return roLegal
  const shell = (legalShell as unknown as Record<string, LegalShellEntry>)[code]
  if (!shell) return enLegal
  return {
    ...enLegal,
    cookie: { ...enLegal.cookie, ...shell.cookie },
    shell: shell.shell,
  }
}

function buildI18nResources() {
  const resources: Record<string, Record<string, unknown>> = {
    el: { home: { ...elHome, faq: elFaq }, subscription: elSubscription, legal: elLegal },
    en: { home: { ...enHome, faq: enFaq }, subscription: enSubscription, legal: enLegal },
    ro: { home: { ...roHome, faq: roFaq }, subscription: roSubscription, legal: roLegal },
  };
  for (const code of LEGACY_HOME_LANGS) {
    if (HOME_JSON_LOCALE_SET.has(code)) continue;
    resources[code] = {
      home: buildLegacyHomeBundle(code),
      subscription: enSubscription,
      legal: legalBundleForUiLang(code),
    };
  }
  for (const code of LEGAL_UI_LANGS) {
    if (resources[code]) continue;
    resources[code] = { legal: legalBundleForUiLang(code) };
  }
  return resources;
}

const initialStored = readStoredAppLang("el");
const initialLang = homeDisplayLocale(initialStored);
const supportedLngs = [...HOME_JSON_LOCALES, ...LEGACY_HOME_LANGS.filter((c) => !HOME_JSON_LOCALE_SET.has(c))];

i18n.use(initReactI18next).init({
  resources: buildI18nResources(),
  lng: initialLang,
  supportedLngs,
  fallbackLng: {
    default: ["en"],
  },
  defaultNS: "home",
  ns: ["home", "subscription", "legal"],
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;
