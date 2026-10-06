import { Link } from 'react-router-dom'
import { AUTH_LOGO_SRC } from '../auth/authLogo'
import { useHomeI18nSync } from '../lib/useHomeI18nSync'
import '../auth/appAuth.css'
import './checkoutResult.css'

export function NotFoundPage() {
  const { isEl } = useHomeI18nSync('subscription')

  return (
    <div className="checkout-result-page is-failure">
      <div className="checkout-result-logo">
        <img src={AUTH_LOGO_SRC} alt="HeyMaa" />
      </div>
      <div className="checkout-result-card">
        <div className="checkout-result-icon failure" aria-hidden>
          404
        </div>
        <h1 className="checkout-result-title">
          {isEl ? 'Η σελίδα δεν βρέθηκε' : 'Page not found'}
        </h1>
        <p className="checkout-result-body">
          {isEl
            ? 'Η διεύθυνση δεν υπάρχει ή μετακινήθηκε.'
            : 'This address does not exist or has moved.'}
        </p>
        <div className="checkout-result-actions">
          <Link to="/" className="app-auth-primary">
            {isEl ? 'Αρχική' : 'Home'}
          </Link>
          <Link to="/privacy" className="app-auth-google">
            {isEl ? 'Απόρρητο' : 'Privacy'}
          </Link>
        </div>
      </div>
    </div>
  )
}
