import React, { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SiteNavbarLogo } from './SiteNavbarLogo'
import { SiteFooter } from './SiteFooter'
import { APP_ROUTE } from '../publicRoutes'
import { HM_TOKEN_KEY } from '../lib/authApi'
import { PRIVACY_URL, TERMS_URL } from '../auth/authStrings'
import { homeDisplayLocale, HOME_I18N_STORAGE_KEY } from '../i18n'
import { normalizeAppLang, readStoredAppLang } from '../lib/appLang'
import '../home/home.css'
import './legalPage.css'

const AUTH_SIGNUP_PATH = `${APP_ROUTE}/auth?mode=signup`

export function LegalPageShell({
  title,
  breadcrumbCurrent,
  children,
}: {
  title: string
  breadcrumbCurrent: string
  children: React.ReactNode
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const fromSignup = search.get('from') === 'signup'
  const contentLang = homeDisplayLocale(readStoredAppLang('el'))
  const isPrivacy =
    breadcrumbCurrent.includes('Απορρήτου') ||
    title.toLowerCase().includes('privacy') ||
    title.includes('Απορρήτου')
  const relatedTo = isPrivacy ? TERMS_URL : PRIVACY_URL
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

  const goToApp = () => {
    if (localStorage.getItem(HM_TOKEN_KEY)) navigate(APP_ROUTE)
    else navigate(`${APP_ROUTE}/auth`)
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
            <button type="button" className="nb-signin" onClick={goToApp}>
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
              aria-label="Επιστροφή στην εγγραφή"
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
              Αρχική
            </Link>
            <span className="legal-breadcrumb-sep" aria-hidden="true">
              {' '}
              –{' '}
            </span>
            <span className="legal-breadcrumb-current" aria-current="page">
              {breadcrumbCurrent}
            </span>
          </nav>
        )}

        <article className="legal-content">{children}</article>

        <nav className="legal-related" aria-label="Σχετικοί σύνδεσμοι">
          {isPrivacy ? (
            <Link to={`${relatedTo}${relatedQs}`}>Όροι &amp; Προϋποθέσεις Χρήσης</Link>
          ) : (
            <Link to={`${relatedTo}${relatedQs}`}>
              Πολιτική Απορρήτου &amp; Προστασίας Δεδομένων
            </Link>
          )}
        </nav>
      </div>

      {!fromSignup && <SiteFooter contentLang={contentLang} />}
    </div>
  )
}
