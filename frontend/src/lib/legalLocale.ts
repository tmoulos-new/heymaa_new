import { LANGS } from '../home/homeContent'
import { normalizeAppLang } from './appLang'

/** UI languages with at least cookie-banner + legal shell strings. */
export const LEGAL_UI_LANGS = LANGS.map((l) => l.code)

export function legalUiLang(stored?: string | null): string {
  const code = normalizeAppLang(stored || 'el', 'el')
  return LEGAL_UI_LANGS.includes(code) ? code : 'en'
}

/** Terms/privacy full text bundles exist only for el and en. */
export function legalDocumentLang(stored?: string | null): 'el' | 'en' {
  return normalizeAppLang(stored || 'el', 'el') === 'el' ? 'el' : 'en'
}
