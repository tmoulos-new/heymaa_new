/** App UI language codes (23). Shared by App, Home, Auth, Checkout. */

export const APP_LANG_CODES = [
  "el", "en", "ar", "zh", "es", "fr", "ro", "pl", "tr", "hi", "ur", "ja",
  "ru", "de", "pt", "it", "nl", "bn", "id", "sw", "fil", "mr", "te",
] as const;

export type AppLangCode = (typeof APP_LANG_CODES)[number];

const APP_LANG_SET = new Set<string>(APP_LANG_CODES);

/** Legacy / alternate codes → canonical app code */
const LANG_ALIASES: Record<string, AppLangCode> = {
  tl: "fil",
  fil_PH: "fil",
  "fil-PH": "fil",
  gr: "el",
  gre: "el",
  eng: "en",
  spa: "es",
  fra: "fr",
  deu: "de",
  por: "pt",
  ita: "it",
  nld: "nl",
  ind: "id",
  zho: "zh",
  cmn: "zh",
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
  if (code === "fil" && v && looksLikeHangul(v)) v = undefined;
  if (v) return v;
  if (row.en) return row.en;
  if (row.el) return row.el;
  return keyFallback;
}
