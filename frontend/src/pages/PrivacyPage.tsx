import React from 'react'
import { useTranslation } from 'react-i18next'
import { LegalDocument } from '../components/LegalDocument'
import { LegalPageShell } from '../components/LegalPageShell'
import { openCookieSettings } from '../lib/cookieConsent'
import { legalUiLang } from '../i18n'
import { readStoredAppLang } from '../lib/appLang'

export function PrivacyPage() {
  const { t } = useTranslation()
  const title = t('privacy.title', { ns: 'legal' })
  const uiLang = legalUiLang(readStoredAppLang('el'))
  const manageLabel = t('cookie.manage', { ns: 'legal', lng: uiLang })

  return (
    <LegalPageShell title={title} docKind="privacy">
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          className="hm-btn hm-btn--secondary hm-btn--sm"
          onClick={() => openCookieSettings()}
        >
          {manageLabel}
        </button>
      </div>
      <LegalDocument docKey="privacy" />
    </LegalPageShell>
  )
}
