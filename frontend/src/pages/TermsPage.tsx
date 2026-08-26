import React from 'react'
import { useTranslation } from 'react-i18next'
import { LegalDocument } from '../components/LegalDocument'
import { LegalPageShell } from '../components/LegalPageShell'

export function TermsPage() {
  const { t } = useTranslation()
  const title = t('terms.title', { ns: 'legal' })

  return (
    <LegalPageShell title={title} docKind="terms">
      <LegalDocument docKey="terms" />
    </LegalPageShell>
  )
}
