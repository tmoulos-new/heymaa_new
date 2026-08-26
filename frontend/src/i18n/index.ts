import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import elHome from "../locales/el/home.json";
import enHome from "../locales/en/home.json";
import elSubscription from "../locales/el/subscription.json";
import enSubscription from "../locales/en/subscription.json";
import elLegal from "../locales/el/legal.json";
import enLegal from "../locales/en/legal.json";
import legalShell from "../locales/legalShell.json";
import { normalizeAppLang, readStoredAppLang } from "../lib/appLang";
import { LEGAL_UI_LANGS, legalDocumentLang, legalUiLang } from "../lib/legalLocale";

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
    el: { home: elHome, subscription: elSubscription, legal: elLegal },
    en: { home: enHome, subscription: enSubscription, legal: enLegal },
  };
  for (const code of LEGAL_UI_LANGS) {
    if (code === "el" || code === "en") continue;
    resources[code] = { legal: legalBundleForUiLang(code) };
  }
  return resources;
}

const initialStored = readStoredAppLang("el");
const initialLang = homeDisplayLocale(initialStored);

i18n.use(initReactI18next).init({
  resources: buildI18nResources(),
  lng: initialLang,
  fallbackLng: {
    default: ["en", "el"],
  },
  defaultNS: "home",
  ns: ["home", "subscription", "legal"],
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;
