import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { HOME_I18N_STORAGE_KEY, homeDisplayLocale, type HomeLocale } from '../i18n'
import { normalizeAppLang, readStoredAppLang } from './appLang'

/** Sync i18next to the user's stored language (el/en bundles). */
export function useHomeI18nSync(ns: 'home' | 'subscription' = 'home') {
  const { t: tBase, i18n } = useTranslation()
  const t = useCallback(
    (key: string, opts?: Record<string, unknown>) => tBase(key, { ns, ...opts }),
    [tBase, ns],
  )

  const locale: HomeLocale = useMemo(() => {
    const stored =
      localStorage.getItem(HOME_I18N_STORAGE_KEY) || readStoredAppLang('el')
    return homeDisplayLocale(normalizeAppLang(stored, 'el'))
  }, [i18n.language])

  useEffect(() => {
    const stored =
      localStorage.getItem(HOME_I18N_STORAGE_KEY) || readStoredAppLang('el')
    void i18n.changeLanguage(homeDisplayLocale(normalizeAppLang(stored, 'el')))
  }, [i18n])

  return { t, i18n, locale, isEl: locale === 'el' }
}
