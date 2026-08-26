import React, { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SiteNavbarLogo } from './SiteNavbarLogo'
import { SiteFooter } from './SiteFooter'
import { APP_ROUTE } from '../publicRoutes'
import { hasAuthToken } from '../lib/authApi'
import { PRIVACY_URL, TERMS_URL } from '../auth/authStrings'
import { homeDisplayLocale, HOME_I18N_STORAGE_KEY } from '../i18n'
import { normalizeAppLang, readStoredAppLang } from '../lib/appLang'
import '../home/home.css'
import './legalPage.css'

const AUTH_SIGNUP_PATH = `${APP_ROUTE}/auth?mode=signup`

export function LegalPageShell({
  title,
  docKind,
  children,
}: {
  title: string
  docKind: 'terms' | 'privacy'
  children: React.ReactNode
}) {
  const { t, i18n } = useTranslation()
  const tl = (key: string) => t(key, { ns: 'legal' })
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const fromSignup = search.get('from') === 'signup'
  const contentLang = homeDisplayLocale(readStoredAppLang('el'))
  const relatedTo = docKind === 'privacy' ? TERMS_URL : PRIVACY_URL
  const relatedLabel =
    docKind === 'privacy' ? tl('shell.relatedTerms') : tl('shell.relatedPrivacy')
  const relatedQs = fromSignup ? '?from=signup' : ''

  useEffect(() => {
    document.title = title
    return () => {
      document.title = 'HeyMaa'
    }
  }, [title])

  useEffect(() => {
    const stored = localStorage.getItem(HOME_I18N_STORAGE_KEY) || readStoredAppLang('el')
    void i18n.changeLanguage(homeDisplayLocale(normalizeAppLang(stored, 'el')))
  }, [i18n])

  const goToLogin = () => {
    if (hasAuthToken()) navigate(APP_ROUTE)
    else navigate(`${APP_ROUTE}/auth?mode=login`)
  }

  return (
    <div className="legal-page" id="landing-page">
      <nav className="navbar">
        <Link
          to={fromSignup ? AUTH_SIGNUP_PATH : '/'}
          className="nb-logo-link"
        >
          <SiteNavbarLogo alt={t('nav.logoAlt')} />
        </Link>
        <div className="nb-right">
          {!fromSignup && (
            <button type="button" className="nb-signin" onClick={goToLogin}>
              {t('nav.signIn')}
            </button>
          )}
        </div>
      </nav>

      <div className="legal-page-inner">
        {fromSignup ? (
          <div className="legal-back-row">
            <Link
              to={AUTH_SIGNUP_PATH}
              className="legal-back-link"
              aria-label={tl('shell.backSignup')}
            >
              <span className="legal-back-arrow" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M15 5L8 12l7 7"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </Link>
          </div>
        ) : (
          <nav className="legal-breadcrumb" aria-label="Breadcrumb">
            <Link to="/" className="legal-breadcrumb-home">
              {tl('shell.home')}
            </Link>
            <span className="legal-breadcrumb-sep" aria-hidden="true">
              {' '}
              –{' '}
            </span>
            <span className="legal-breadcrumb-current" aria-current="page">
              {title}
            </span>
          </nav>
        )}

        <article className="legal-content">{children}</article>

        <nav className="legal-related" aria-label="Related links">
          <Link to={`${relatedTo}${relatedQs}`}>{relatedLabel}</Link>
        </nav>
      </div>

      {!fromSignup && <SiteFooter contentLang={contentLang} />}
    </div>
  )
}
