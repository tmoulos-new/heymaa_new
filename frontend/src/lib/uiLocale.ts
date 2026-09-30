import { normalizeAppLang } from './appLang'

/** BCP 47 locale for dates / numbers in the app UI. */
export function uiDateLocale(lang: string | null | undefined): string {
  const code = normalizeAppLang(lang, 'en')
  if (code === 'el') return 'el-GR'
  if (code === 'ro') return 'ro-RO'
  return 'en-GB'
}
