import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { HM_TOKEN_KEY } from '../lib/authApi'
import { AUTH_LOGO_SRC } from '../auth/authLogo'
import { APP_ROUTE } from '../publicRoutes'
import { clearPlanIntent } from '../lib/planCheckoutFlow'
import { useHomeI18nSync } from '../lib/useHomeI18nSync'
import '../auth/appAuth.css'
import './checkoutResult.css'

const SUB_SNAPSHOT_CACHE_KEY = 'hm_subscription_snapshot'

export function CheckoutResultPage({ outcome }: { outcome: 'success' | 'failure' }) {
  const [search] = useSearchParams()
  const { t, locale } = useHomeI18nSync('subscription')
  const token = localStorage.getItem(HM_TOKEN_KEY)
  const tx =
    search.get('t') ||
    search.get('transactionId') ||
    search.get('TransactionId') ||
    ''
  const logoSrc = AUTH_LOGO_SRC
  const isSuccess = outcome === 'success'

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    if (!isSuccess) return
    clearPlanIntent()
    try {
      sessionStorage.removeItem(SUB_SNAPSHOT_CACHE_KEY)
    } catch {
      /* ignore */
    }
  }, [isSuccess])

  const title = isSuccess
    ? t('checkoutResult.successTitle')
    : t('checkoutResult.failureTitle')

  const body = isSuccess
    ? t('checkoutResult.successBody')
    : t('checkoutResult.failureBody')

  return (
    <div className={`checkout-result-page${isSuccess ? '' : ' is-failure'}`}>
      <div className="checkout-result-logo">
        <img src={logoSrc} alt={t('checkout.logoAlt')} />
      </div>
      <div className="checkout-result-card">
        <div className={`checkout-result-icon ${isSuccess ? 'success' : 'failure'}`} aria-hidden>
          {isSuccess ? '✓' : '✕'}
        </div>
        <h1 className="checkout-result-title">{title}</h1>
        <p className="checkout-result-body">{body}</p>
        {tx ? (
          <p className="checkout-result-tx">
            {t('checkoutResult.transactionRef')}: {tx}
          </p>
        ) : (
          <div style={{ height: 12 }} />
        )}
        <div className="checkout-result-actions">
          {isSuccess ? (
            token ? (
              <Link to={APP_ROUTE} className="app-auth-primary">
                {t('checkoutResult.continueApp')}
              </Link>
            ) : (
              <Link to={`${APP_ROUTE}/auth`} className="app-auth-primary">
                {t('checkoutResult.signIn')}
              </Link>
            )
          ) : (
            <Link to="/subscription" className="app-auth-primary">
              {t('checkoutResult.tryAgain')}
            </Link>
          )}
          <Link
            to={isSuccess ? '/subscription' : token ? APP_ROUTE : '/'}
            className="app-auth-google"
          >
            {isSuccess
              ? t('checkoutResult.viewPlans')
              : token
                ? t('checkoutResult.backToApp')
                : t('checkoutResult.home')}
          </Link>
        </div>
      </div>
    </div>
  )
}
