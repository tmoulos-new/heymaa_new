import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SiteNavbarLogo } from './SiteNavbarLogo'
import { APP_ROUTE } from '../publicRoutes'
import { HM_TOKEN_KEY } from '../lib/authApi'
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
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = title
    return () => {
      document.title = 'HeyMaa'
    }
  }, [title])

  const goToApp = () => {
    if (localStorage.getItem(HM_TOKEN_KEY)) navigate(APP_ROUTE)
    else navigate(`${APP_ROUTE}/auth`)
  }

  return (
    <div className="legal-page">
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
      </div>
    </div>
  )
}
