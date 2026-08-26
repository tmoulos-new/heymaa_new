import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { createVivaCheckout, getAuthToken, apiDetail } from '../lib/authApi'
import { AUTH_LOGO_SRC } from '../auth/authLogo'
import { setPlanIntent } from '../lib/planCheckoutFlow'
import { useHomeI18nSync } from '../lib/useHomeI18nSync'
import type { HomePlan } from '../i18n/homeTypes'
import { APP_ROUTE } from '../publicRoutes'
import '../auth/appAuth.css'
import '../home/home.css'
import './checkout.css'

const VALID_PLANS = new Set(['starter', 'premium', 'annual'])
const TABLER_ICONS =
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css'

function asObjectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const plan = (search.get('plan') || '').toLowerCase()
  const { t, locale } = useHomeI18nSync('subscription')
  const { t: tBase } = useTranslation()
  const tHome = useCallback(
    (key: string, opts?: Record<string, unknown>) => tBase(key, { ns: 'home', ...opts }),
    [tBase],
  )
  const [error, setError] = useState('')
  const [purchasing, setPurchasing] = useState(false)
  const [ready, setReady] = useState(false)
  const token = getAuthToken()

  const plans = useMemo(
    () => asObjectArray<HomePlan>(tHome('pricing.plans', { returnObjects: true })),
    [tHome],
  )

  const selectedPlan = useMemo(
    () => plans.find((p) => p.variant === plan) ?? null,
    [plans, plan],
  )

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = TABLER_ICONS
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [])

  useEffect(() => {
    if (!plan || !VALID_PLANS.has(plan)) {
      setReady(true)
      setError(t('checkout.invalidPlan'))
      return
    }

    if (!token) {
      setPlanIntent(plan)
      navigate(`${APP_ROUTE}/auth`, { replace: true })
      return
    }

    setReady(true)
  }, [plan, token, t, navigate])

  const handleBuy = async () => {
    if (!token || !VALID_PLANS.has(plan) || purchasing) return
    setError('')
    setPurchasing(true)
    try {
      const data = await createVivaCheckout(plan, locale, token)
      window.location.href = data.checkoutUrl
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } }
      setError(
        apiDetail(err.response?.data, e instanceof Error ? e.message : t('checkout.failed')),
      )
      setPurchasing(false)
    }
  }

  const logoSrc = AUTH_LOGO_SRC
  const backHref = token ? '/subscription' : '/'

  return (
    <div className="app-auth-page checkout-page">
      <div className="app-auth-logo-wrap">
        <img src={logoSrc} alt={t('checkout.logoAlt')} />
      </div>
      <div className="app-auth-card">
        <h1 className="app-auth-title" style={{ textAlign: 'center', marginBottom: 6 }}>
          {t('checkout.title')}
        </h1>
        <p
          style={{
            textAlign: 'center',
            fontSize: 14,
            color: 'rgba(43,58,103,.65)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {t('checkout.reviewSubtitle')}
        </p>

        {!ready ? (
          <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(43,58,103,.75)' }}>
            {t('checkout.loading')}
          </p>
        ) : null}

        {ready && selectedPlan ? (
          <div className="checkout-plan-card">
            <div className="checkout-plan-head">
              <div className="checkout-plan-icon" aria-hidden="true">
                {selectedPlan.icon}
              </div>
              <div className="checkout-plan-title-wrap">
                <div className="checkout-plan-name">{selectedPlan.name}</div>
                <div className="checkout-plan-price-row">
                  <span className="checkout-plan-price">{selectedPlan.price}</span>
                  <span className="checkout-plan-period">{selectedPlan.period}</span>
                </div>
                {selectedPlan.badge ? (
                  <span
                    className="checkout-plan-badge"
                    style={{ background: selectedPlan.badgeColor || '#2B3A67' }}
                  >
                    {selectedPlan.badge}
                  </span>
                ) : null}
              </div>
            </div>
            <p className="checkout-plan-includes">{t('checkout.includes')}</p>
            <ul className="checkout-plan-feats">
              {selectedPlan.features.map((feature) => (
                <li key={feature}>
                  <i className="ti ti-check" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="app-auth-error" style={{ marginBottom: 16 }}>
            {error}
          </p>
        ) : null}

        <div className="checkout-actions">
          {ready && selectedPlan && VALID_PLANS.has(plan) ? (
            <button
              type="button"
              className="app-auth-primary"
              disabled={purchasing}
              onClick={() => void handleBuy()}
            >
              {purchasing ? t('checkout.redirecting') : t('checkout.buy')}
            </button>
          ) : null}
          <div className="checkout-actions-row">
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
    </div>
  )
}
