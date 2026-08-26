type Props = {
  lang: string
}

export function ChatMedicalDisclaimer({ lang }: Props) {
  const isEl = lang === 'el'
  return (
    <div className="hm-chat-medical-banner" role="note" aria-live="polite">
      <span className="hm-chat-medical-banner__icon" aria-hidden="true">
        ⚕️
      </span>
      <p className="hm-chat-medical-banner__text">
        {isEl
          ? 'Το HeyMaa δεν αντικαθιστά γιατρό ή φαρμακοποιό. Για θέματα υγείας δικού σου ή του παιδιού, απευθύνσου πάντα σε επαγγελματία υγείας.'
          : 'HeyMaa is not a substitute for a doctor or pharmacist. For any health concern — yours or your child\'s — always speak with a qualified healthcare professional.'}
      </p>
    </div>
  )
}
