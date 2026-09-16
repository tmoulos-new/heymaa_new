import { LANGS } from '../home/homeContent'
import { normalizeAppLang } from './appLang'
import { SUPPORTED_LANG_CODE_SET } from './supportedLanguages'

/** UI languages with complete legal shell strings (Greek + English). */
export const LEGAL_UI_LANGS = LANGS.map((l) => l.code).filter((code) =>
  SUPPORTED_LANG_CODE_SET.has(code),
)

export function legalUiLang(stored?: string | null): string {
  const code = normalizeAppLang(stored || 'el', 'el')
  return LEGAL_UI_LANGS.includes(code) ? code : 'en'
}

/** Terms/privacy full text bundles exist only for el and en. */
export function legalDocumentLang(stored?: string | null): 'el' | 'en' {
  return normalizeAppLang(stored || 'el', 'el') === 'el' ? 'el' : 'en'
}
