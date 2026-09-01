import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PlanCard } from './PlanCard'
import { AppSheet } from './AppSheet'
import { SheetHeader } from './ui/SheetHeader'
import '../home/home.css'
import '../appResponsive.css'
import { homeDisplayLocale } from '../i18n'
import type { HomePlan } from '../i18n/homeTypes'
import { continueWithPlan } from '../lib/planCheckoutFlow'
import {
  fetchSubscriptionStatus,
  requestSubscriptionCancel,
  type SubscriptionSnapshot,
} from '../lib/authApi'
import {
  applySubscriptionPlanState,
  activePlanNameForSlot,
  displaySelectedPlanSlot,
  formatTrialEnd,
  slotForPlanIndex,
} from '../lib/subscriptionPlans'

const TABLER_ICONS =
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css'

function asObjectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function InAppSubscriptionSheet({
  token,
  lang,
  trialEndsAt,
  initialSnapshot,
  onClose,
  onOpenHelp,
}: {
  token: string
  lang: string
  trialEndsAt?: string | null
  initialSnapshot?: SubscriptionSnapshot | null
  onClose: () => void
  onOpenHelp?: () => void
}) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const tHome = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      t(key, { ns: 'home', ...opts }),
    [t],
  )
  const tSub = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      t(key, { ns: 'subscription', ...opts }),
    [t],
  )

  const contentLang = homeDisplayLocale(lang || i18n.language || 'el')
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(initialSnapshot ?? null)
  const [loading, setLoading] = useState(!initialSnapshot)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelError, setCancelError] = useState('')

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
    if (initialSnapshot) setSnapshot(initialSnapshot)
  }, [initialSnapshot])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchSubscriptionStatus(token)
      .then((data) => {
        if (!cancelled) setSnapshot(data)
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshot(initialSnapshot ?? null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, trialEndsAt])

  const basePlans = asObjectArray<HomePlan>(
    tHome('pricing.plans', { returnObjects: true }),
  )

  const plans = useMemo(
    () =>
      applySubscriptionPlanState(
        basePlans,
        snapshot,
        {
          currentBadge: tSub('plan.currentBadge'),
          currentButton: tSub('plan.currentButton'),
          expiredBadge: tSub('trial.expiredBadge'),
          expiredButton: tSub('trial.expiredButton'),
          signupButton: tSub('trial.signupButton'),
        },
        true,
      ),
    [basePlans, snapshot, tSub],
  )

  const heroKey = useMemo(() => {
    if (!snapshot) return 'default'
    if (!snapshot.subscription_active && snapshot.subscription_status === 'trial') {
      return 'expired'
    }
    if (snapshot.is_trial) return 'trial'
    return 'default'
  }, [snapshot])

  const activeSlot = useMemo(() => displaySelectedPlanSlot(snapshot), [snapshot])
  const activePlanRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!activeSlot || loading) return
    const timer = window.setTimeout(() => {
      activePlanRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [activeSlot, loading])

  const activePlanName = useMemo(
    () => (activeSlot ? activePlanNameForSlot(activeSlot, basePlans, lang) : null),
    [activeSlot, basePlans, lang],
  )

  const showCancelHelp =
    !!snapshot?.subscription_active &&
    !!activeSlot &&
    activeSlot !== 'trial'

  const cancelPending = !!snapshot?.cancel_requested

  const handleCancelRequest = async () => {
    setCancelError('')
    setCancelBusy(true)
    try {
      const res = await requestSubscriptionCancel(token)
      setSnapshot((prev) => (prev ? { ...prev, cancel_requested: true } : prev))
      if (!res.ok) setCancelError(res.message || tSub('cancel.pendingBody'))
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setCancelError(err.response?.data?.detail || tSub('cancel.pendingBody'))
    } finally {
      setCancelBusy(false)
    }
  }

  const supportEmail = 'info@heymaa.ai'
  const supportPhone = String(tHome('footer.phone') || '210 928 7420')
  const supportPhoneTel = String(tHome('footer.phoneTel') || '+302109287420')
  const supportPhoneLabel = String(tHome('footer.phoneLabel') || (lang === 'el' ? 'Γραμμή Εξυπηρέτησης' : 'Support line'))

  return (
    <AppSheet
      open
      wide
      onClose={onClose}
      ariaLabel={lang === 'el' ? 'Συνδρομή' : 'Subscription'}
    >
      <div className="hm-subscription-sheet-inner in-app-subscription-sheet">
        <SheetHeader
          title={lang === 'el' ? 'Συνδρομή' : 'Subscription'}
          subtitle={
            tSub(`hero.${heroKey}.subtitle`) ||
            (lang === 'el'
              ? 'Δες τα πλάνα και ποιο είναι ενεργό τώρα.'
              : 'See plans and which one is active now.')
          }
          onBack={onClose}
          backLabel={lang === 'el' ? 'Πίσω' : 'Back'}
        />
        {snapshot?.is_trial && snapshot.trial_ends_at ? (
          <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--hm-navy)', fontWeight: 600 }}>
            {tSub('hero.trialEnds', {
              date: formatTrialEnd(snapshot.trial_ends_at, contentLang),
            })}
          </p>
        ) : null}
        {activePlanName ? (
          <div className="hm-subscription-active-chip">
            <span className="hm-subscription-active-chip__dot" aria-hidden="true" />
            {lang === 'el'
              ? `Ενεργό πλάνο: ${activePlanName}`
              : `Active plan: ${activePlanName}`}
          </div>
        ) : null}

        {loading ? (
          <div className="hm-empty-state" style={{ padding: '40px 12px' }}>
            {lang === 'el' ? 'Φόρτωση πλάνων…' : 'Loading plans…'}
          </div>
        ) : (
          <div className="pricing-stack" style={{ gap: 12, marginTop: 18 }}>
            {plans.map((plan, index) => {
              const slot = slotForPlanIndex(index)
              const isActive = activeSlot === slot
              const trialExpired =
                slot === 'trial' &&
                !!snapshot &&
                !snapshot.subscription_active &&
                snapshot.subscription_status === 'trial'
              return (
                <div
                  key={`${plan.name}-${index}`}
                  ref={isActive ? activePlanRef : undefined}
                  data-plan-slot={slot}
                  className={isActive ? 'hm-subscription-plan-active' : undefined}
                >
                  <PlanCard
                    plan={plan}
                    disabled={trialExpired || isActive}
                    buttonState={isActive ? 'current' : 'idle'}
                    radioSelected={isActive}
                    onButtonClick={() =>
                      continueWithPlan(
                        isActive ? slot : plan.variant || slot || 'trial',
                        navigate,
                      )
                    }
                  />
                </div>
              )
            })}
          </div>
        )}

        {showCancelHelp ? (
          <div className="hm-subscription-cancel-card">
            <div className="hm-subscription-cancel-card__title">
              {cancelPending ? tSub('cancel.pendingTitle') : tSub('cancel.title')}
            </div>
            <p className="hm-subscription-cancel-card__body">
              {cancelPending ? tSub('cancel.pendingBody') : tSub('cancel.body')}
            </p>
            {cancelError ? (
              <p className="hm-subscription-cancel-card__body" style={{ color: 'var(--hm-coral, #e85d4c)' }}>
                {cancelError}
              </p>
            ) : null}
            <div className="hm-subscription-cancel-card__actions">
              {!cancelPending ? (
                <button
                  type="button"
                  className="hm-btn hm-btn--secondary hm-btn--block"
                  disabled={cancelBusy}
                  onClick={() => void handleCancelRequest()}
                >
                  {cancelBusy ? (lang === 'el' ? 'Αποστολή…' : 'Sending…') : tSub('cancel.requestButton')}
                </button>
              ) : null}
              <a
                href={`mailto:${supportEmail}?subject=${encodeURIComponent('HeyMaa — subscription cancel')}`}
                className="hm-btn hm-btn--ghost hm-btn--block"
              >
                {tSub('cancel.emailButton')}
              </a>
              <a
                href={`tel:${supportPhoneTel}`}
                className="hm-btn hm-btn--ghost hm-btn--block"
              >
                {supportPhoneLabel} {supportPhone}
              </a>
              {onOpenHelp ? (
                <button
                  type="button"
                  className="hm-btn hm-btn--ghost hm-btn--block"
                  onClick={() => {
                    onClose()
                    onOpenHelp()
                  }}
                >
                  {tSub('cancel.helpButton')}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </AppSheet>
  )
}
