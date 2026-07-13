import { Link, useSearchParams } from 'react-router-dom'
import { HM_TOKEN_KEY } from '../lib/authApi'
import { APP_ROUTE } from '../publicRoutes'
import '../auth/appAuth.css'

export function CheckoutResultPage({ outcome }: { outcome: 'success' | 'failure' }) {
  const [search] = useSearchParams()
  const lang = localStorage.getItem('hm_pre_lang') === 'en' ? 'en' : 'el'
  const isEl = lang === 'el'
  const token = localStorage.getItem(HM_TOKEN_KEY)
  const tx = search.get('t') || search.get('transactionId') || ''
  const logoSrc = `${process.env.PUBLIC_URL}/logo192.png`

  const title =
    outcome === 'success'
      ? isEl
        ? 'Η πληρωμή ολοκληρώθηκε'
        : 'Payment completed'
      : isEl
        ? 'Η πληρωμή απέτυχε'
        : 'Payment failed'

  const body =
    outcome === 'success'
      ? isEl
        ? 'Η συνδρομή σου θα ενεργοποιηθεί σύντομα. Αν δεν βλέπεις αλλαγή αμέσως, κάνε refresh.'
        : 'Your subscription will activate shortly. Refresh if you do not see changes immediately.'
      : isEl
        ? 'Η πληρωμή δεν ολοκληρώθηκε. Μπορείς να δοκιμάσεις ξανά.'
        : 'Payment was not completed. You can try again.'

  return (
    <div className="app-auth-page">
      <div className="app-auth-logo-wrap">
        <img src={logoSrc} alt="HeyMaa" />
      </div>
      <div className="app-auth-card" style={{ textAlign: 'center' }}>
        <h1 className="app-auth-title">{title}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(43,58,103,.75)', margin: '0 0 20px' }}>
          {body}
        </p>
        {tx ? (
          <p style={{ fontSize: 12, color: 'rgba(43,58,103,.55)', marginBottom: 20 }}>
            {isEl ? 'Αναφορά συναλλαγής' : 'Transaction'}: {tx}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {token ? (
            <Link to={APP_ROUTE} className="app-auth-primary" style={{ textDecoration: 'none' }}>
              {isEl ? 'Συνέχεια στην εφαρμογή →' : 'Continue to app →'}
            </Link>
          ) : (
            <Link to={`${APP_ROUTE}/auth`} className="app-auth-primary" style={{ textDecoration: 'none' }}>
              {isEl ? 'Σύνδεση →' : 'Sign in →'}
            </Link>
          )}
          <Link to="/subscription" className="app-auth-google" style={{ textDecoration: 'none' }}>
            {isEl ? 'Πακέτα' : 'Plans'}
          </Link>
        </div>
      </div>
    </div>
  )
}
