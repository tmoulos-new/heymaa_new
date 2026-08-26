import React from 'react'
import { useTranslation } from 'react-i18next'
import { LegalDocument } from '../components/LegalDocument'
import { LegalPageShell } from '../components/LegalPageShell'

export function PrivacyPage() {
  const { t } = useTranslation()
  const title = t('privacy.title', { ns: 'legal' })

  return (
    <LegalPageShell title={title} docKind="privacy">
      <LegalDocument docKey="privacy" />
    </LegalPageShell>
  )
}
