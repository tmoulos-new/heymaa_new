import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { HM_TOKEN_KEY } from '../lib/authApi'
import { AUTH_LOGO_SRC } from '../auth/authLogo'
import { APP_ROUTE } from '../publicRoutes'
import '../auth/appAuth.css'
import './checkoutResult.css'

const SUB_SNAPSHOT_CACHE_KEY = 'hm_subscription_snapshot'

export function CheckoutResultPage({ outcome }: { outcome: 'success' | 'failure' }) {
  const [search] = useSearchParams()
  const lang = localStorage.getItem('hm_pre_lang') === 'en' ? 'en' : 'el'
  const isEl = lang === 'el'
  const token = localStorage.getItem(HM_TOKEN_KEY)
  const tx =
    search.get('t') ||
    search.get('transactionId') ||
    search.get('TransactionId') ||
    ''
  const logoSrc = AUTH_LOGO_SRC
  const isSuccess = outcome === 'success'

  useEffect(() => {
    if (!isSuccess) return
    try {
      sessionStorage.removeItem(SUB_SNAPSHOT_CACHE_KEY)
    } catch {
      /* ignore */
    }
  }, [isSuccess])

  const title = isSuccess
    ? isEl
      ? 'Η πληρωμή ολοκληρώθηκε'
      : 'Payment successful'
    : isEl
      ? 'Η πληρωμή απέτυχε'
      : 'Payment failed'

  const body = isSuccess
    ? isEl
      ? 'Ευχαριστούμε! Η συνδρομή σου θα ενεργοποιηθεί σε λίγα λεπτά. Αν δεν βλέπεις αλλαγή αμέσως, άνοιξε ξανά την εφαρμογή.'
      : 'Thank you! Your subscription will activate shortly. If you do not see the change yet, reopen the app.'
    : isEl
      ? 'Η πληρωμή δεν ολοκληρώθηκε ή ακυρώθηκε. Μπορείς να δοκιμάσεις ξανά από τα πακέτα.'
      : 'Payment was not completed or was cancelled. You can try again from the plans page.'

  return (
    <div className={`checkout-result-page${isSuccess ? '' : ' is-failure'}`}>
      <div className="checkout-result-logo">
        <img src={logoSrc} alt="HeyMaa" />
      </div>
      <div className="checkout-result-card">
        <div className={`checkout-result-icon ${isSuccess ? 'success' : 'failure'}`} aria-hidden>
          {isSuccess ? '✓' : '✕'}
        </div>
        <h1 className="checkout-result-title">{title}</h1>
        <p className="checkout-result-body">{body}</p>
        {tx ? (
          <p className="checkout-result-tx">
            {isEl ? 'Αναφορά συναλλαγής' : 'Transaction'}: {tx}
          </p>
        ) : (
          <div style={{ height: 12 }} />
        )}
        <div className="checkout-result-actions">
          {isSuccess ? (
            token ? (
              <Link to={APP_ROUTE} className="app-auth-primary">
                {isEl ? 'Συνέχεια στην εφαρμογή →' : 'Continue to app →'}
              </Link>
            ) : (
              <Link to={`${APP_ROUTE}/auth`} className="app-auth-primary">
                {isEl ? 'Σύνδεση →' : 'Sign in →'}
              </Link>
            )
          ) : (
            <Link to="/subscription" className="app-auth-primary">
              {isEl ? 'Δοκίμασε ξανά →' : 'Try again →'}
            </Link>
          )}
          <Link
            to={isSuccess ? '/subscription' : token ? APP_ROUTE : '/'}
            className="app-auth-google"
          >
            {isSuccess
              ? isEl
                ? 'Δες τα πακέτα'
                : 'View plans'
              : token
                ? isEl
                  ? 'Επιστροφή στην εφαρμογή'
                  : 'Back to app'
                : isEl
                  ? 'Αρχική'
                  : 'Home'}
          </Link>
        </div>
      </div>
    </div>
  )
}
