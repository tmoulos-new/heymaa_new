import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createVivaCheckout, HM_TOKEN_KEY } from '../lib/authApi'
import { AUTH_LOGO_SRC } from '../auth/authLogo'
import { setPlanIntent } from '../lib/planCheckoutFlow'
import { useHomeI18nSync } from '../lib/useHomeI18nSync'
import { APP_ROUTE } from '../publicRoutes'
import '../auth/appAuth.css'

const VALID_PLANS = new Set(['starter', 'premium', 'annual'])

export function CheckoutPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const plan = (search.get('plan') || '').toLowerCase()
  const { t, locale } = useHomeI18nSync('subscription')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem(HM_TOKEN_KEY)

  const planLabel = useMemo(() => {
    if (!VALID_PLANS.has(plan)) return plan
    return t(`checkout.plans.${plan}`)
  }, [plan, t])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    if (!plan || !VALID_PLANS.has(plan)) {
      setLoading(false)
      setError(t('checkout.invalidPlan'))
      return
    }

    if (!token) {
      setPlanIntent(plan)
      navigate(`${APP_ROUTE}/auth`, { replace: true })
      return
    }

    let cancelled = false
    createVivaCheckout(plan, locale, token)
      .then((data) => {
        if (cancelled) return
        window.location.href = data.checkoutUrl
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const err = e as { response?: { data?: unknown } }
        const detail =
          err.response?.data && typeof err.response.data === 'object'
            ? String((err.response.data as { detail?: string }).detail || '')
            : ''
        setError(
          detail ||
            (e instanceof Error ? e.message : t('checkout.failed')),
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [plan, locale, token, t, navigate])

  const logoSrc = AUTH_LOGO_SRC
  const backHref = token ? '/subscription' : '/'

  return (
    <div className="app-auth-page">
      <div className="app-auth-logo-wrap">
        <img src={logoSrc} alt={t('checkout.logoAlt')} />
      </div>
      <div className="app-auth-card" style={{ textAlign: 'center' }}>
        <h1 className="app-auth-title">{t('checkout.title')}</h1>
        {planLabel ? (
          <p style={{ fontSize: 14, color: 'rgba(43,58,103,.75)', marginBottom: 20 }}>
            {planLabel}
          </p>
        ) : null}
        {loading && !error ? (
          <p style={{ fontSize: 14, color: 'rgba(43,58,103,.75)' }}>
            {t('checkout.redirecting')}
          </p>
        ) : null}
        {error ? (
          <p className="app-auth-error" style={{ marginBottom: 16 }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={backHref} className="app-auth-google" style={{ textDecoration: 'none' }}>
            {t('checkout.backToPlans')}
          </Link>
          {token ? (
            <Link to={APP_ROUTE} className="app-auth-google" style={{ textDecoration: 'none' }}>
              {t('checkout.backToApp')}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
