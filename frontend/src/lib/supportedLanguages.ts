/** Supported HeyMaa UI + chat languages (landing flag picker, app, FAQ). */
export const SUPPORTED_LANG_CODES = [
  "el",
  "en",
  "it",
  "de",
  "fr",
  "es",
  "ro",
  "bg",
  "pl",
  "sr",
  "ar",
  "tr",
  "zh",
  "ja",
  "ru",
  "pt",
  "nl",
] as const;

export type SupportedLangCode = (typeof SUPPORTED_LANG_CODES)[number];

export const SUPPORTED_LANG_CODE_SET = new Set<string>(SUPPORTED_LANG_CODES);
