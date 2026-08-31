import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PlanCard } from '../components/PlanCard'
import { SiteFooter } from '../components/SiteFooter'
import { SiteNavbarLogo } from '../components/SiteNavbarLogo'
import '../home/home.css'
import './subscription.css'
import {
  HOME_I18N_STORAGE_KEY,
  homeDisplayLocale,
} from '../i18n'
import { normalizeAppLang, writeStoredAppLang } from '../lib/appLang'
import type { HomeFaqItem, HomePlan } from '../i18n/homeTypes'
import {
  fetchSubscriptionStatus,
  getAuthToken,
  type SubscriptionSnapshot,
} from '../lib/authApi'
import { mergeGamificationFaqItems } from '../lib/gamificationCard'
import {
  applySubscriptionPlanState,
  displaySelectedPlanSlot,
  formatTrialEnd,
  slotForPlanIndex,
} from '../lib/subscriptionPlans'
import { LANGS } from '../home/homeContent'
import { LanguageFlagOverlay, LanguageTriggerCode } from '../components/LanguageFlagPicker'
import { APP_ROUTE } from '../publicRoutes'
import { continueWithPlan } from '../lib/planCheckoutFlow'

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

const TABLER_ICONS =
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css'

function asObjectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function SubscriptionPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const tHome = useCallback(
    (key: string, opts?: Record<string, unknown>) => t(key, { ns: 'home', ...opts }),
    [t],
  )
  const tSub = useCallback(
    (key: string, opts?: Record<string, unknown>) => t(key, { ns: 'subscription', ...opts }),
    [t],
  )
  const [langOpen, setLangOpen] = useState(false)
  const [openFaqs, setOpenFaqs] = useState<Record<number, boolean>>({})
  const token = getAuthToken()
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(() =>
    readCachedSnapshot(token),
  )

  const preferredLang = normalizeAppLang(
    localStorage.getItem(HOME_I18N_STORAGE_KEY) || i18n.language || 'el',
    'el',
  )
  const contentLang = homeDisplayLocale(preferredLang)
  const langMeta = LANGS.find((l) => l.code === preferredLang) ?? LANGS[0]

  const basePlans = asObjectArray<HomePlan>(
    tHome('pricing.plans', { returnObjects: true }),
  )
  const faqItems = useMemo(() => {
    const base = asObjectArray<HomeFaqItem>(tHome('faq.items', { returnObjects: true }))
    const faqLang = contentLang === 'el' ? 'el' : 'en'
    return mergeGamificationFaqItems(base, faqLang)
  }, [tHome, contentLang])

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
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = TABLER_ICONS
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [])

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
      const normalized = writeStoredAppLang(code)
      void i18n.changeLanguage(homeDisplayLocale(normalized))
      setLangOpen(false)
    },
    [i18n],
  )

  const toggleFaq = (i: number) => {
    setOpenFaqs((prev) => ({ ...prev, [i]: !prev[i] }))
  }

  const selectedSlot = displaySelectedPlanSlot(snapshot)

  const goApp = () => navigate(token ? APP_ROUTE : `${APP_ROUTE}/auth`)
  const goLogin = () => navigate(token ? APP_ROUTE : `${APP_ROUTE}/auth?mode=login`)

  return (
    <div className="subscription-page">
      <LanguageFlagOverlay
        open={langOpen}
        title={String(tHome('langPicker.title'))}
        currentLang={preferredLang}
        onClose={() => setLangOpen(false)}
        onSelect={setLang}
        searchPlaceholder={String(tHome('langPicker.search'))}
        selectLabel={String(tHome('langPicker.select'))}
        emptyLabel={String(tHome('langPicker.empty'))}
      />

      <nav className="navbar">
        <SiteNavbarLogo alt={tSub('nav.logoAlt')} />
        <div className="nb-right">
          <button
            type="button"
            className="lang-trigger"
            onClick={() => setLangOpen(true)}
          >
            <LanguageTriggerCode code={preferredLang} />
            <span>{langMeta.name}</span>
            <i className="ti ti-chevron-down" style={{ fontSize: 11 }} />
          </button>
          {token ? (
            <button type="button" className="nb-cta" onClick={goApp}>
              {tSub('nav.backToApp')}
            </button>
          ) : (
            <button type="button" className="nb-signin" onClick={goLogin}>
              {tSub('nav.signIn')}
            </button>
          )}
        </div>
      </nav>

      <div className="hero subscription-hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          <span>{tSub(`hero.${heroKey}.badge`)}</span>
        </div>
        {tSub(`hero.${heroKey}.title`) ? (
          <h1 dangerouslySetInnerHTML={{ __html: tSub(`hero.${heroKey}.title`) }} />
        ) : null}
        {tSub(`hero.${heroKey}.subtitle`) ? (
          <p className="hero-sub">{tSub(`hero.${heroKey}.subtitle`)}</p>
        ) : null}
        {snapshot?.is_trial && snapshot.trial_ends_at ? (
          <p className="subscription-trial-ends">
            {tSub('hero.trialEnds', {
              date: formatTrialEnd(snapshot.trial_ends_at, contentLang),
            })}
          </p>
        ) : null}
      </div>

      <div className="section pricing-section" style={{ paddingTop: 0 }}>
        <div className="pricing-panel">
          <div className="pricing-panel-header">
            <h2 className="sec-title pricing-panel-title">{tHome('pricing.title')}</h2>
            <p className="pricing-panel-sub">{tHome('pricing.subtitle')}</p>
          </div>
          <div className="pricing-panel-body">
            <div className="pricing-cards-layout">
              <div className="pricing-trial-col">
                {plans.slice(0, 1).map((plan, index) => {
                  const slot = slotForPlanIndex(index)
                  const isSelected = selectedSlot === slot
                  const trialExpired =
                    slot === 'trial' &&
                    !!snapshot &&
                    !snapshot.subscription_active &&
                    snapshot.subscription_status === 'trial'
                  const buttonState =
                    plan.variant === 'current' ? 'current' : isSelected ? 'selected' : 'idle'
                  return (
                    <PlanCard
                      plan={plan}
                      key={plan.name}
                      disabled={trialExpired}
                      buttonState={buttonState}
                      radioSelected={isSelected}
                      onButtonClick={() =>
                        continueWithPlan(plan.variant === 'current' ? slot : plan.variant || slot, navigate)
                      }
                    />
                  )
                })}
              </div>
              <div className="pricing-paid-grid">
                {plans.slice(1).map((plan, offset) => {
                  const index = offset + 1
                  const slot = slotForPlanIndex(index)
                  const isSelected = selectedSlot === slot
                  const trialExpired =
                    slot === 'trial' &&
                    !!snapshot &&
                    !snapshot.subscription_active &&
                    snapshot.subscription_status === 'trial'
                  const buttonState =
                    plan.variant === 'current' ? 'current' : isSelected ? 'selected' : 'idle'
                  return (
                    <PlanCard
                      plan={plan}
                      key={plan.name}
                      disabled={trialExpired}
                      buttonState={buttonState}
                      radioSelected={isSelected}
                      onButtonClick={() =>
                        continueWithPlan(plan.variant === 'current' ? slot : plan.variant || slot, navigate)
                      }
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section faq-section">
        <div className="sec-title">{tHome('faq.label')}</div>
        <div className="faq-list">
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

      <SiteFooter contentLang={contentLang} />
    </div>
  )
}
