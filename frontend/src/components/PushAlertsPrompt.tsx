import React, { useState } from 'react'
import {
  dismissPushPrompt,
  isIosDevice,
  isStandaloneDisplay,
} from '../lib/pushAlerts'
import { enablePush } from '../lib/inboxNotifications'

type Props = {
  lang: string
  token: string
  open: boolean
  onClose: () => void
  onGranted: () => void
  onOptInChange?: (next: boolean) => void
}

export function PushAlertsPrompt({ lang, token, open, onClose, onGranted, onOptInChange }: Props) {
  const isEl = lang === 'el'
  const [busy, setBusy] = useState(false)
  if (!open) return null

  const needsHomeScreen = isIosDevice() && !isStandaloneDisplay()

  const later = () => {
    dismissPushPrompt(token)
    onClose()
  }

  const allow = async () => {
    if (needsHomeScreen) {
      // Cannot get lock-screen push until installed; keep soft opt-in and close.
      onOptInChange?.(true)
      dismissPushPrompt(token)
      onClose()
      return
    }
    setBusy(true)
    try {
      const result = await enablePush(token)
      if (result === 'granted') {
        onOptInChange?.(true)
        onGranted()
        dismissPushPrompt(token)
        onClose()
      } else if (result === 'denied') {
        onOptInChange?.(false)
        dismissPushPrompt(token)
        onClose()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hm-push-prompt" role="dialog" aria-label={isEl ? 'Ειδοποιήσεις' : 'Alerts'}>
      <div className="hm-push-prompt__card">
        <div className="hm-push-prompt__icon" aria-hidden="true">
          🔔
        </div>
        <h2 className="hm-push-prompt__title">
          {isEl ? 'Μην χάνεις τα μηνύματα της HeyMaa' : 'Don’t miss HeyMaa updates'}
        </h2>
        <p className="hm-push-prompt__body">
          {needsHomeScreen
            ? (isEl
              ? 'Στο iPhone, πρόσθεσε πρώτα την HeyMaa στην Αρχική οθόνη (Safari → Κοινή χρήση → Προσθήκη στην αρχική οθόνη). Μετά άνοιξέ την από εκεί και επίτρεψε τις ειδοποιήσεις.'
              : 'On iPhone, add HeyMaa to your Home Screen first (Safari → Share → Add to Home Screen). Open it from there, then allow notifications.')
            : (isEl
              ? 'Ενεργοποίησε τις ειδοποιήσεις οθόνης κλειδώματος για να λαμβάνεις σημαντικά μηνύματα ακόμα και όταν η εφαρμογή είναι κλειστή. Μπορείς να το αλλάξεις ανά πάσα στιγμή.'
              : 'Activate lock-screen alerts so you still hear from HeyMaa when the app is closed. You can change this anytime in settings.')}
        </p>
        <div className="hm-push-prompt__actions">
          <button type="button" className="hm-btn hm-btn--ghost" disabled={busy} onClick={later}>
            {isEl ? 'Όχι τώρα' : 'Not now'}
          </button>
          <button type="button" className="hm-btn hm-btn--primary" disabled={busy} onClick={() => void allow()}>
            {busy
              ? (isEl ? 'Ένα λεπτό…' : 'One moment…')
              : needsHomeScreen
                ? (isEl ? 'Το κατάλαβα' : 'Got it')
                : (isEl ? 'Ενεργοποίηση' : 'Activate alerts')}
          </button>
        </div>
      </div>
    </div>
  )
}
