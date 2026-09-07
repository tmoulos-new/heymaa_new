import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import elHome from "../locales/el/home.json";
import enHome from "../locales/en/home.json";
import elFaq from "../locales/el/faq.json";
import enFaq from "../locales/en/faq.json";
import elSubscription from "../locales/el/subscription.json";
import enSubscription from "../locales/en/subscription.json";
import elLegal from "../locales/el/legal.json";
import enLegal from "../locales/en/legal.json";
import legalShell from "../locales/legalShell.json";
import { normalizeAppLang, readStoredAppLang } from "../lib/appLang";
import { LEGAL_UI_LANGS, legalDocumentLang, legalUiLang } from "../lib/legalLocale";
import {
  buildLegacyHomeBundle,
  hasLegacyHomeBundle,
  LEGACY_HOME_LANGS,
} from "./homeLegacyBundles";

export const HOME_I18N_STORAGE_KEY = "hm_pre_lang";

/** Locales with the primary el/en JSON landing bundles. */
export const HOME_JSON_LOCALES = ["el", "en"] as const;
export type HomeJsonLocale = (typeof HOME_JSON_LOCALES)[number];

/** @deprecated Use HOME_JSON_LOCALES — kept for callers that only need el/en JSON. */
export const HOME_LOCALES = HOME_JSON_LOCALES;
export type HomeLocale = HomeJsonLocale | (typeof LEGACY_HOME_LANGS)[number];

export function isHomeLocale(lang: string): lang is HomeLocale {
  const code = normalizeAppLang(lang);
  return code === "el" || code === "en" || hasLegacyHomeBundle(code);
}

/** i18next language for the landing page: el/en JSON, or legacy bundle for other langs. */
export function homeDisplayLocale(stored: string): string {
  const code = normalizeAppLang(stored, "el");
  if (code === "el" || code === "en") return code;
  if (hasLegacyHomeBundle(code)) return code;
  return "en";
}

export { legalDocumentLang, legalUiLang };

type LegalShellEntry = {
  cookie: (typeof enLegal)["cookie"];
  shell: (typeof enLegal)["shell"];
};

function legalBundleForUiLang(code: string): typeof enLegal {
  if (code === "el") return elLegal;
  if (code === "en") return enLegal;
  const shell = (legalShell as Record<string, LegalShellEntry>)[code];
  if (!shell) return enLegal;
  return {
    ...enLegal,
    cookie: shell.cookie,
    shell: shell.shell,
  };
}

function buildI18nResources() {
  const resources: Record<string, Record<string, unknown>> = {
    el: { home: { ...elHome, faq: elFaq }, subscription: elSubscription, legal: elLegal },
    en: { home: { ...enHome, faq: enFaq }, subscription: enSubscription, legal: enLegal },
  };
  for (const code of LEGACY_HOME_LANGS) {
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
const supportedLngs = ["el", "en", ...LEGACY_HOME_LANGS];

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
