import { SUPPORTED_LANG_CODES } from "./supportedLanguages";

/** App UI language codes — Greek + English only (complete interface). */
export const APP_LANG_CODES = SUPPORTED_LANG_CODES;

export type AppLangCode = (typeof APP_LANG_CODES)[number];

const APP_LANG_SET = new Set<string>(APP_LANG_CODES);

/** Legacy / alternate codes → canonical app code */
const LANG_ALIASES: Record<string, AppLangCode> = {
  tl: "el",
  fil_PH: "el",
  "fil-PH": "el",
  fil: "el",
  gr: "el",
  gre: "el",
  eng: "en",
  // Former multi-language codes map to English until those UIs are ready
  spa: "en",
  fra: "en",
  deu: "en",
  por: "en",
  ita: "en",
  nld: "en",
  ind: "en",
  zho: "en",
  cmn: "en",
  bul: "en",
  srp: "en",
  es: "en",
  fr: "en",
  de: "en",
  pt: "en",
  it: "en",
  nl: "en",
  zh: "en",
  ja: "en",
  ru: "en",
  ar: "en",
  tr: "en",
  ro: "en",
  bg: "en",
  pl: "en",
  sr: "en",
};

const PRE_LANG_KEY = "hm_pre_lang";

export function normalizeAppLang(code: string | null | undefined, fallback: AppLangCode = "en"): AppLangCode {
  if (!code) return fallback;
  const raw = String(code).trim().toLowerCase().replace("_", "-");
  const base = raw.split("-")[0];
  const aliased = LANG_ALIASES[raw] || LANG_ALIASES[base] || raw;
  if (APP_LANG_SET.has(aliased)) return aliased as AppLangCode;
  return fallback;
}

export function readStoredAppLang(fallback: AppLangCode = "en"): AppLangCode {
  try {
    return normalizeAppLang(localStorage.getItem(PRE_LANG_KEY), fallback);
  } catch {
    return fallback;
  }
}

export function writeStoredAppLang(code: string): AppLangCode {
  const normalized = normalizeAppLang(code, "en");
  try {
    localStorage.setItem(PRE_LANG_KEY, normalized);
  } catch {
    /* ignore */
  }
  return normalized;
}

/** Hangul / other wrong-script contamination in some TR.fil entries historically. */
function looksLikeHangul(s: string): boolean {
  return /[\uAC00-\uD7AF]/.test(s);
}

/** Prefer requested lang, then en, then el. Skip contaminated fil Hangul strings. */
export function pickTranslated(
  row: Record<string, string> | undefined,
  lang: string,
  keyFallback = "",
): string {
  if (!row) return keyFallback;
  const code = normalizeAppLang(lang, "en");
  let v = row[code];
  if ((code as string) === "fil" && v && looksLikeHangul(v)) v = undefined;
  if (v) return v;
  if (row.en) return row.en;
  if (row.el) return row.el;
  return keyFallback;
}
