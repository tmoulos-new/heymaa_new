import { AppSheet } from './AppSheet'
import type { AccessExpiryInfo } from '../lib/accessExpiry'
import { expiryPopupCopy } from '../lib/accessExpiry'

type Props = {
  open: boolean
  lang: string
  info: AccessExpiryInfo | null
  onClose: () => void
  onRenew: () => void
}

export function AccessExpiryModal({ open, lang, info, onClose, onRenew }: Props) {
  if (!info) return null
  const copy = expiryPopupCopy(info, lang)

  return (
    <AppSheet
      open={open}
      onClose={onClose}
      ariaLabel={copy.title}
    >
      <div className="hm-expiry-modal">
        <div className="hm-expiry-modal__icon" aria-hidden="true">
          ⏳
        </div>
        <h2 className="hm-expiry-modal__title">{copy.title}</h2>
        <p className="hm-expiry-modal__body">{copy.body}</p>
        <button
          type="button"
          className="hm-expiry-modal__cta"
          onClick={() => {
            onClose()
            onRenew()
          }}
        >
          {copy.cta}
        </button>
        <button type="button" className="hm-expiry-modal__later" onClick={onClose}>
          {lang === 'el' ? 'Αργότερα' : 'Later'}
        </button>
      </div>
    </AppSheet>
  )
}
