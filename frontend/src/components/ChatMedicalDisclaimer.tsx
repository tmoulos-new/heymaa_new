type Props = {
  lang: string
}

export function ChatMedicalDisclaimer({ lang }: Props) {
  const isEl = lang === 'el'
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
          : 'HeyMaa is not a substitute for a doctor or pharmacist. For any health concern — yours or your child\'s — always speak with a qualified healthcare professional.'}
      </p>
    </div>
  )
}
