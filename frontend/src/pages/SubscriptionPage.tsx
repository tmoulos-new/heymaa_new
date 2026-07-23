import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PlanCard } from '../components/PlanCard'
import '../home/home.css'
import {
  HOME_I18N_STORAGE_KEY,
  isHomeLocale,
} from '../i18n'
import type { HomeFaqItem, HomePlan, HomeSafetyItem } from '../i18n/homeTypes'
import {
  fetchSubscriptionStatus,
  HM_TOKEN_KEY,
  type SubscriptionSnapshot,
} from '../lib/authApi'
import { LANGS, mf } from '../home/homeContent'
import { displayUppercase } from '../lib/greekText'
import { APP_ROUTE } from '../publicRoutes'

const SUB_SNAPSHOT_CACHE_KEY = 'hm_subscription_snapshot'

function readCachedSnapshot(token: string | null): SubscriptionSnapshot | null {
  if (!token) return null
  try {
    const raw = sessionStorage.getItem(SUB_SNAPSHOT_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { token?: string; data?: SubscriptionSnapshot }
    if (parsed.token !== token || !parsed.data) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeCachedSnapshot(token: string, data: SubscriptionSnapshot) {
  try {
    sessionStorage.setItem(
      SUB_SNAPSHOT_CACHE_KEY,
      JSON.stringify({ token, data }),
    )
  } catch {
    /* ignore quota errors */
  }
}

function asObjectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function FlagHtml({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

type PlanSlot = 'trial' | 'starter' | 'premium' | 'annual'

const PLAN_SLOTS: PlanSlot[] = ['trial', 'starter', 'premium', 'annual']

function slotForPlanIndex(index: number): PlanSlot {
  return PLAN_SLOTS[index] ?? 'trial'
}

function slotForPaidPlan(plan?: string | null): PlanSlot | null {
  const p = (plan || '').toLowerCase()
  if (p.includes('annual') || p.includes('year')) return 'annual'
  if (p.includes('premium')) return 'premium'
  if (p.includes('starter')) return 'starter'
  return null
}

function formatTrialEnd(iso: string, locale: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function applySubscriptionPlanState(
  plans: HomePlan[],
  snapshot: SubscriptionSnapshot | null,
  labels: {
    currentBadge: string
    currentButton: string
    expiredBadge: string
    expiredButton: string
    signupButton: string
  },
  hasToken: boolean,
): HomePlan[] {
  if (!snapshot) {
    if (hasToken) {
      return plans.map((plan) =>
        plan.variant === 'current'
          ? { ...plan, variant: '', badge: '', badgeColor: '' }
          : plan,
      )
    }
    return plans.map((plan, index) => {
      if (slotForPlanIndex(index) !== 'trial') return plan
      return {
        ...plan,
        variant: '',
        badge: '',
        badgeColor: '',
        button: labels.signupButton,
        buttonClass: 'btn-ghost-p',
      }
    })
  }

  const { subscription_active, is_trial, subscription_status, plan } = snapshot
  const status = (subscription_status || '').toLowerCase()
  const paidSlot = slotForPaidPlan(plan)
  const trialExpired = status === 'trial' && !subscription_active
  const trialActive = is_trial && subscription_active

  let currentSlot: PlanSlot | null = null
  if (trialActive) currentSlot = 'trial'
  else if (subscription_active && paidSlot) currentSlot = paidSlot

  return plans.map((plan, index) => {
    const slot = slotForPlanIndex(index)
    const base = { ...plan, variant: plan.variant === 'current' ? '' : plan.variant }

    if (slot === 'trial' && trialExpired) {
      return {
        ...base,
        variant: '',
        badge: labels.expiredBadge,
        badgeColor: '#E07B54',
        button: labels.expiredButton,
        buttonClass: 'btn-ghost-p',
      }
    }

    if (currentSlot === slot) {
      return {
        ...base,
        variant: 'current',
        badge: labels.currentBadge,
        badgeColor: '#2D9E6B',
        button: labels.currentButton,
        buttonClass: 'btn-ghost-p',
      }
    }

    return base
  })
}

export function SubscriptionPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const tHome = (key: string, opts?: Record<string, unknown>) => t(key, { ns: 'home', ...opts })
  const tSub = useCallback(
    (key: string, opts?: Record<string, unknown>) => t(key, { ns: 'subscription', ...opts }),
    [t],
  )
  const [langOpen, setLangOpen] = useState(false)
  const [openFaqs, setOpenFaqs] = useState<Record<number, boolean>>({})
  const token = localStorage.getItem(HM_TOKEN_KEY)
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(() =>
    readCachedSnapshot(token),
  )

  const contentLang = isHomeLocale(i18n.language) ? i18n.language : 'el'
  const langMeta = LANGS.find((l) => l.code === contentLang) ?? LANGS[0]

  const basePlans = asObjectArray<HomePlan>(
    tHome('pricing.plans', { returnObjects: true }),
  )
  const safetyItems = asObjectArray<HomeSafetyItem>(
    tHome('safety.items', { returnObjects: true }),
  )
  const faqItems = asObjectArray<HomeFaqItem>(
    tHome('faq.items', { returnObjects: true }),
  )

  const plans = useMemo(
    () =>
      applySubscriptionPlanState(basePlans, snapshot, {
        currentBadge: tSub('plan.currentBadge'),
        currentButton: tSub('plan.currentButton'),
        expiredBadge: tSub('trial.expiredBadge'),
        expiredButton: tSub('trial.expiredButton'),
        signupButton: tSub('trial.signupButton'),
      }, !!token),
    [basePlans, snapshot, tSub, token],
  )

  const heroKey = useMemo(() => {
    if (!token || !snapshot) return 'default'
    if (!snapshot.subscription_active && snapshot.subscription_status === 'trial') {
      return 'expired'
    }
    if (snapshot.is_trial) return 'trial'
    return 'default'
  }, [token, snapshot])

  useEffect(() => {
    if (!token) {
      setSnapshot(null)
      return
    }
    let cancelled = false
    fetchSubscriptionStatus(token)
      .then((data) => {
        if (cancelled) return
        setSnapshot(data)
        writeCachedSnapshot(token, data)
      })
      .catch(() => {
        if (!cancelled) setSnapshot(readCachedSnapshot(token))
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const setLang = useCallback(
    (code: string) => {
      if (!isHomeLocale(code)) return
      i18n.changeLanguage(code)
      localStorage.setItem(HOME_I18N_STORAGE_KEY, code)
      setLangOpen(false)
    },
    [i18n],
  )

  const toggleFaq = (i: number) => {
    setOpenFaqs((prev) => ({ ...prev, [i]: !prev[i] }))
  }

  const goApp = () => navigate(token ? APP_ROUTE : `${APP_ROUTE}/auth`)

  return (
    <div>
      <div
        className={`lang-overlay${langOpen ? ' open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setLangOpen(false)
        }}
        role="presentation"
      >
        <div className="lang-box">
          <div className="lang-box-hdr">
            <div className="lang-box-title">{tHome('langPicker.title')}</div>
            <button
              type="button"
              className="lang-close"
              onClick={() => setLangOpen(false)}
              aria-label={tHome('langPicker.close')}
            >
              ×
            </button>
          </div>
          <div className="flag-grid">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`flag-item${l.code === contentLang ? ' active' : ''}`}
                onClick={() => setLang(l.code)}
              >
                <FlagHtml html={mf(l.code, 40, 27)} />
                <span className="flag-lname">{l.name}</span>
                <span className="flag-lvoice">{l.voice}</span>
                <span className="active-pip" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <nav className="navbar">
        <div className="nb-logo">
          <img
            src={`${process.env.PUBLIC_URL}/logo192.png`}
            alt={tSub('nav.logoAlt')}
          />
          <span className="nb-logo-text">
            Hey<span>Maa</span>
          </span>
        </div>
        <div className="nb-right">
          <button
            type="button"
            className="lang-trigger"
            onClick={() => setLangOpen(true)}
          >
            <FlagHtml html={mf(contentLang, 22, 15)} />
            <span>{langMeta.name}</span>
            <i className="ti ti-chevron-down" style={{ fontSize: 11 }} />
          </button>
          {token ? (
            <button type="button" className="nb-cta" onClick={goApp}>
              {tSub('nav.backToApp')}
            </button>
          ) : (
            <button type="button" className="nb-signin" onClick={goApp}>
              {tSub('nav.signIn')}
            </button>
          )}
        </div>
      </nav>

      <div className="hero" style={{ paddingBottom: 32 }}>
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          <span>{tSub(`hero.${heroKey}.badge`)}</span>
        </div>
        <h1 dangerouslySetInnerHTML={{ __html: tSub(`hero.${heroKey}.title`) }} />
        <p className="hero-sub">{tSub(`hero.${heroKey}.subtitle`)}</p>
        {snapshot?.is_trial && snapshot.trial_ends_at ? (
          <p className="hero-sub" style={{ marginTop: -12, fontSize: 13 }}>
            {tSub('hero.trialEnds', {
              date: formatTrialEnd(snapshot.trial_ends_at, contentLang),
            })}
          </p>
        ) : null}
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="sec-label">{displayUppercase(tHome('pricing.label'), contentLang)}</div>
        <div className="sec-title">{tHome('pricing.title')}</div>
        <div className="pricing-grid">
          {plans.map((plan, index) => {
              const slot = slotForPlanIndex(index)
              const trialExpired =
                slot === 'trial' &&
                !!snapshot &&
                !snapshot.subscription_active &&
                snapshot.subscription_status === 'trial'
              const trialSignup = slot === 'trial' && !token
              return (
                <PlanCard
                  plan={plan}
                  key={plan.name}
                  disabled={trialExpired}
                  onButtonClick={trialSignup ? () => navigate(`${APP_ROUTE}/auth`) : undefined}
                />
            )
          })}
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="safety-wrap">
          <div className="sec-label">{displayUppercase(tHome('safety.label'), contentLang)}</div>
          <div className="sec-title">{tHome('safety.title')}</div>
          <div className="sec-sub">{tHome('safety.subtitle')}</div>
          <div className="safety-grid">
            {safetyItems.map((item) => (
              <div className="safety-card" key={item.title}>
                <div
                  className="safety-card-icon"
                  style={{ background: item.bg }}
                >
                  {item.icon}
                </div>
                <div className="safety-card-title">{item.title}</div>
                <div className="safety-card-body">{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="sec-label">{displayUppercase(tHome('faq.label'), contentLang)}</div>
        <div className="sec-title">{tHome('faq.title')}</div>
        <div>
          {faqItems.map((item, i) => {
            const open = !!openFaqs[i]
            return (
              <div className="faq-item" key={item.question}>
                <div
                  className={`faq-q${open ? ' open' : ''}`}
                  onClick={() => toggleFaq(i)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') toggleFaq(i)
                  }}
                >
                  <span>{item.question}</span>
                  <i className="ti ti-chevron-down" />
                </div>
                <div className={`faq-a${open ? ' open' : ''}`}>
                  {item.answer}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="footer">
        <div className="footer-logo">
          <img
            src={`${process.env.PUBLIC_URL}/logo192.png`}
            alt={tHome('footer.logoAlt')}
          />
          <span className="footer-logo-text">
            Hey<span>Maa</span>
          </span>
        </div>
        <div className="footer-copy">{tHome('footer.copy')}</div>
      </div>
    </div>
  )
}
