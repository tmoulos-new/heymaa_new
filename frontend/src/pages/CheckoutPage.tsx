import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createVivaCheckout, HM_TOKEN_KEY } from '../lib/authApi'
import { AUTH_LOGO_SRC } from '../auth/authLogo'
import { normalizeAppLang } from '../lib/appLang'
import { setPlanIntent } from '../lib/planCheckoutFlow'
import { APP_ROUTE } from '../publicRoutes'
import '../auth/appAuth.css'

const PLAN_LABELS: Record<string, { el: string; en: string }> = {
  starter: { el: 'Starter', en: 'Starter' },
  premium: { el: 'Premium', en: 'Premium' },
  annual: { el: 'Ετήσιο Premium', en: 'Annual Premium' },
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const plan = (search.get('plan') || '').toLowerCase()
  const preferred = normalizeAppLang(localStorage.getItem('hm_pre_lang') || 'en', 'en')
  const lang = preferred === 'el' ? 'el' : 'en'
  const isEl = lang === 'el'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem(HM_TOKEN_KEY)

  const planLabel = useMemo(() => {
    const labels = PLAN_LABELS[plan]
    if (!labels) return plan
    return isEl ? labels.el : labels.en
  }, [plan, isEl])

  useEffect(() => {
    if (!plan || !PLAN_LABELS[plan]) {
      setLoading(false)
      setError(isEl ? 'Μη έγκυρο πακέτο.' : 'Invalid plan.')
      return
    }

    if (!token) {
      setPlanIntent(plan)
      navigate(`${APP_ROUTE}/auth`, { replace: true })
      return
    }

    let cancelled = false
    createVivaCheckout(plan, lang, token)
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
            (e instanceof Error ? e.message : isEl ? 'Αποτυχία checkout.' : 'Checkout failed.'),
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [plan, lang, token, isEl, navigate])

  const logoSrc = AUTH_LOGO_SRC
  const backHref = token ? '/subscription' : '/'

  return (
    <div className="app-auth-page">
      <div className="app-auth-logo-wrap">
        <img src={logoSrc} alt="HeyMaa" />
      </div>
      <div className="app-auth-card" style={{ textAlign: 'center' }}>
        <h1 className="app-auth-title">
          {isEl ? 'Ολοκλήρωση πληρωμής' : 'Complete payment'}
        </h1>
        {planLabel ? (
          <p style={{ fontSize: 14, color: 'rgba(43,58,103,.75)', marginBottom: 20 }}>
            {planLabel}
          </p>
        ) : null}
        {loading && !error ? (
          <p style={{ fontSize: 14, color: 'rgba(43,58,103,.75)' }}>
            {isEl ? 'Σε λίγο θα μεταφερθείς στο Viva Wallet…' : 'Redirecting to Viva Wallet…'}
          </p>
        ) : null}
        {error ? (
          <p className="app-auth-error" style={{ marginBottom: 16 }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={backHref} className="app-auth-google" style={{ textDecoration: 'none' }}>
            {isEl ? '← Πίσω στα πακέτα' : '← Back to plans'}
          </Link>
          {token ? (
            <Link to={APP_ROUTE} className="app-auth-google" style={{ textDecoration: 'none' }}>
              {isEl ? 'Επιστροφή στην εφαρμογή' : 'Back to app'}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
