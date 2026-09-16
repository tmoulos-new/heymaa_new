import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from './ConfirmDialog'
import { useState } from 'react'

export type SubscriptionRequiredReason = 'trial_expired' | 'subscription_inactive'

type Props = {
  lang: string
  reason: SubscriptionRequiredReason
  onLogout: () => void
}

function copy(lang: string, reason: SubscriptionRequiredReason) {
  const el = lang === 'el'
  if (reason === 'trial_expired') {
    return {
      badge: el ? 'Δοκιμή έληξε' : 'Trial ended',
      title: el ? 'Η δωρεάν δοκιμή σου έληξε' : 'Your free trial has ended',
      body: el
        ? 'Για να συνεχίσεις να χρησιμοποιείς την HeyMaa, επίλεξε ένα ενεργό πλάνο συνδρομής.'
        : 'To keep using HeyMaa, choose an active subscription plan.',
      cta: el ? 'Επίλεξε πλάνο' : 'Choose a plan',
      logout: el ? 'Αποσύνδεση' : 'Log out',
      logoutTitle: el ? 'Αποσύνδεση' : 'Log out',
      logoutMessage: el
        ? 'Είσαι σίγουρη/ος ότι θέλεις να αποσυνδεθείς;'
        : 'Are you sure you want to log out?',
    }
  }
  return {
    badge: el ? 'Χωρίς ενεργή συνδρομή' : 'No active subscription',
    title: el ? 'Η συνδρομή δεν είναι ενεργή' : 'Your subscription is not active',
    body: el
      ? 'Η πρόσβαση στην εφαρμογή απαιτεί ενεργή συνδρομή. Ανανέωσε ή επίλεξε πλάνο για να συνεχίσεις.'
      : 'App access requires an active subscription. Renew or choose a plan to continue.',
    cta: el ? 'Ανανέωση / Επίλεξε πλάνο' : 'Renew / Choose a plan',
    logout: el ? 'Αποσύνδεση' : 'Log out',
    logoutTitle: el ? 'Αποσύνδεση' : 'Log out',
    logoutMessage: el
      ? 'Είσαι σίγουρη/ος ότι θέλεις να αποσυνδεθείς;'
      : 'Are you sure you want to log out?',
  }
}

/** Blocking gate when trial/subscription access has ended — explain why + clear renew CTA. */
export function SubscriptionRequiredScreen({ lang, reason, onLogout }: Props) {
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const t = copy(lang, reason)

  return (
    <div className="hm-sub-required" role="alertdialog" aria-modal="true" aria-labelledby="hm-sub-required-title">
      <div className="hm-sub-required__card">
        <div className="hm-sub-required__brand" aria-hidden="true">
          Hey<span>Maa</span>
        </div>
        <p className="hm-sub-required__badge">{t.badge}</p>
        <h1 id="hm-sub-required-title" className="hm-sub-required__title">
          {t.title}
        </h1>
        <p className="hm-sub-required__body">{t.body}</p>
        <button
          type="button"
          className="hm-btn hm-btn--primary hm-btn--block hm-btn--lg"
          onClick={() => navigate('/subscription')}
        >
          {t.cta}
        </button>
        <button
          type="button"
          className="hm-btn hm-btn--ghost hm-btn--block"
          style={{ marginTop: 12 }}
          onClick={() => setShowLogoutConfirm(true)}
        >
          {t.logout}
        </button>
      </div>
      {showLogoutConfirm && (
        <ConfirmDialog
          open={showLogoutConfirm}
          title={t.logoutTitle}
          message={t.logoutMessage}
          confirmLabel={t.logout}
          cancelLabel={lang === 'el' ? 'Ακύρωση' : 'Cancel'}
          variant="danger"
          onConfirm={() => {
            setShowLogoutConfirm(false)
            onLogout()
          }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  )
}

export function resolveSubscriptionRequiredReason(
  status: string | null | undefined,
): SubscriptionRequiredReason {
  return (status || '').toLowerCase() === 'trial' ? 'trial_expired' : 'subscription_inactive'
}
