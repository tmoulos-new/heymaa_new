/** Supported HeyMaa UI languages (complete interface only). */
export const SUPPORTED_LANG_CODES = ["el", "en"] as const;

export type SupportedLangCode = (typeof SUPPORTED_LANG_CODES)[number];

export const SUPPORTED_LANG_CODE_SET = new Set<string>(SUPPORTED_LANG_CODES);
