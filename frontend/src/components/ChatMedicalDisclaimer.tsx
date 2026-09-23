import { useState } from 'react'
import { storageScope } from '../lib/memoriesSync'

const STORAGE_SUFFIX = 'chat_medical_banner_dismissed'

function storageKey(token?: string | null) {
  if (token) return `hm_${STORAGE_SUFFIX}_${storageScope(token)}`
  return `hm_${STORAGE_SUFFIX}`
}

type Props = {
  lang: string
  token?: string | null
}

export function ChatMedicalDisclaimer({ lang, token }: Props) {
  const isEl = lang === 'el'
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey(token)) === '1'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey(token), '1')
    } catch {
      /* ignore quota / private mode */
    }
    setDismissed(true)
  }

  return (
    <div className="hm-chat-medical-banner" role="note" aria-live="polite">
      <span className="hm-chat-medical-banner__icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 11.2v5.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="8.2" r="1.05" fill="currentColor" />
        </svg>
      </span>
      <p className="hm-chat-medical-banner__text">
        {isEl
          ? 'Το HeyMaa δεν αντικαθιστά γιατρό ή φαρμακοποιό. Για θέματα υγείας δικά σου ή του παιδιού σου, απευθύνσου πάντα σε επαγγελματία υγείας.'
          : "HeyMaa is not a substitute for a doctor or pharmacist. For any health concern — yours or your child's — always speak with a qualified healthcare professional."}
      </p>
      <button
        type="button"
        className="hm-chat-medical-banner__close"
        aria-label={isEl ? 'Κλείσιμο' : 'Dismiss'}
        onClick={dismiss}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
