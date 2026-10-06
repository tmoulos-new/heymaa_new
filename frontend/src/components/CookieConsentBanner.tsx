import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  COOKIE_SETTINGS_EVENT,
  hasCookieConsentDecision,
  writeCookieConsent,
} from '../lib/cookieConsent'
import { revokeAnalyticsAndReload } from '../lib/analytics/revoke'
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
  const [settingsMode, setSettingsMode] = useState(false)

  useEffect(() => {
    setVisible(!hasCookieConsentDecision())
  }, [])

  useEffect(() => {
    const open = () => {
      setSettingsMode(true)
      setVisible(true)
    }
    window.addEventListener(COOKIE_SETTINGS_EVENT, open)
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, open)
  }, [])

  if (!visible) return null

  const accept = () => {
    writeCookieConsent(true)
    setVisible(false)
    setSettingsMode(false)
    onConsentChange?.(true)
  }

  const essentialOnly = () => {
    // Revoke path: stop tags and reload so a previously loaded container cannot continue.
    if (settingsMode || hasCookieConsentDecision()) {
      revokeAnalyticsAndReload()
      return
    }
    writeCookieConsent(false)
    setVisible(false)
    setSettingsMode(false)
    onConsentChange?.(false)
  }

  return (
    <div className="hm-cookie-banner" role="dialog" aria-labelledby="hm-cookie-title">
      <div className="hm-cookie-banner__inner">
        <p id="hm-cookie-title" className="hm-cookie-banner__title">
          {settingsMode ? tl('cookie.settingsTitle') : tl('cookie.title')}
        </p>
        <p className="hm-cookie-banner__body">
          {settingsMode ? tl('cookie.settingsBody') : tl('cookie.body')}{' '}
          <Link to={`${PRIVACY_URL}#cookies`} className="hm-cookie-banner__link">
            {tl('cookie.privacyLink')}
          </Link>
        </p>
        <div className="hm-cookie-banner__actions">
          <button
            type="button"
            className="hm-btn hm-btn--primary hm-btn--sm"
            onClick={accept}
          >
            {tl('cookie.accept')}
          </button>
          <button
            type="button"
            className="hm-btn hm-btn--secondary hm-btn--sm"
            onClick={essentialOnly}
          >
            {settingsMode ? tl('cookie.revoke') : tl('cookie.reject')}
          </button>
        </div>
      </div>
    </div>
  )
}
