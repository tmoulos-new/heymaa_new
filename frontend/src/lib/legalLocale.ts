import { LANGS } from '../home/homeContent'
import { normalizeAppLang } from './appLang'
import { SUPPORTED_LANG_CODE_SET } from './supportedLanguages'

/** UI languages with complete legal shell strings. */
export const LEGAL_UI_LANGS = LANGS.map((l) => l.code).filter((code) =>
  SUPPORTED_LANG_CODE_SET.has(code),
)

export function legalUiLang(stored?: string | null): string {
  const code = normalizeAppLang(stored || 'el', 'el')
  return LEGAL_UI_LANGS.includes(code) ? code : 'en'
}

/** Terms/privacy full text bundles exist for el, en, and ro. */
export function legalDocumentLang(stored?: string | null): 'el' | 'en' | 'ro' {
  const code = normalizeAppLang(stored || 'el', 'el')
  if (code === 'el' || code === 'ro') return code
  return 'en'
}
