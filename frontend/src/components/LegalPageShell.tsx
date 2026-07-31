import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  const contentLang = homeDisplayLocale(readStoredAppLang('el'))
  const isPrivacy =
    breadcrumbCurrent.includes('Απορρήτου') ||
    title.toLowerCase().includes('privacy') ||
    title.includes('Απορρήτου')

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
        <Link to="/" className="nb-logo-link">
          <SiteNavbarLogo alt={t('nav.logoAlt')} />
        </Link>
        <div className="nb-right">
          <button type="button" className="nb-signin" onClick={goToApp}>
            {t('nav.signIn')}
          </button>
        </div>
      </nav>

      <div className="legal-page-inner">
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

        <article className="legal-content">{children}</article>

        <nav className="legal-related" aria-label="Σχετικοί σύνδεσμοι">
          {isPrivacy ? (
            <Link to={TERMS_URL}>Όροι &amp; Προϋποθέσεις Χρήσης</Link>
          ) : (
            <Link to={PRIVACY_URL}>Πολιτική Απορρήτου &amp; Προστασίας Δεδομένων</Link>
          )}
        </nav>
      </div>

      <SiteFooter contentLang={contentLang} />
    </div>
  )
}
