import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  hasCookieConsentDecision,
  writeCookieConsent,
} from '../lib/cookieConsent'
import { readStoredAppLang } from '../lib/appLang'
import { legalUiLang } from '../i18n'
import { PRIVACY_URL } from '../auth/authStrings'
import './cookieConsent.css'

type Props = {
  onConsentChange?: (analytics: boolean) => void
}

export function CookieConsentBanner({ onConsentChange }: Props) {
  const { t } = useTranslation()
  const uiLang = legalUiLang(readStoredAppLang('el'))
  const tl = (key: string) => t(key, { ns: 'legal', lng: uiLang })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!hasCookieConsentDecision())
  }, [])

  if (!visible) return null

  const decide = (analytics: boolean) => {
    writeCookieConsent(analytics)
    setVisible(false)
    onConsentChange?.(analytics)
  }

  return (
    <div className="hm-cookie-banner" role="dialog" aria-labelledby="hm-cookie-title">
      <div className="hm-cookie-banner__inner">
        <p id="hm-cookie-title" className="hm-cookie-banner__title">
          {tl('cookie.title')}
        </p>
        <p className="hm-cookie-banner__body">
          {tl('cookie.body')}{' '}
          <Link to={PRIVACY_URL} className="hm-cookie-banner__link">
            {tl('cookie.privacyLink')}
          </Link>
        </p>
        <div className="hm-cookie-banner__actions">
          <button
            type="button"
            className="hm-btn hm-btn--primary hm-btn--sm"
            onClick={() => decide(true)}
          >
            {tl('cookie.accept')}
          </button>
          <button
            type="button"
            className="hm-btn hm-btn--secondary hm-btn--sm"
            onClick={() => decide(false)}
          >
            {tl('cookie.reject')}
          </button>
        </div>
      </div>
    </div>
  )
}
