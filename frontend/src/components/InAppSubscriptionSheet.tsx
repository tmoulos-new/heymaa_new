import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlanCard } from './PlanCard'
import '../home/home.css'
import '../appResponsive.css'
import { homeDisplayLocale } from '../i18n'
import type { HomePlan } from '../i18n/homeTypes'
import {
  fetchSubscriptionStatus,
  type SubscriptionSnapshot,
} from '../lib/authApi'
import {
  applySubscriptionPlanState,
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
  onClose,
}: {
  token: string
  lang: string
  trialEndsAt?: string | null
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const tHome = (key: string, opts?: Record<string, unknown>) =>
    t(key, { ns: 'home', ...opts })
  const tSub = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      t(key, { ns: 'subscription', ...opts }),
    [t],
  )

  const contentLang = homeDisplayLocale(lang || i18n.language || 'el')
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

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
    let cancelled = false
    setLoading(true)
    fetchSubscriptionStatus(token)
      .then((data) => {
        if (!cancelled) setSnapshot(data)
      })
      .catch(() => {
        if (!cancelled) {
          // Local/demo fallback: treat active free trial as current
          if (trialEndsAt) {
            setSnapshot({
              subscription_active: true,
              subscription_status: 'trial',
              trial_ends_at: trialEndsAt,
              is_trial: true,
              plan: 'trial',
            })
          } else {
            setSnapshot({
              subscription_active: true,
              subscription_status: 'trial',
              trial_ends_at: null,
              is_trial: true,
              plan: 'trial',
            })
          }
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

  const navy = '#2B3A67'
  const cream = '#F7F1EA'

  return (
    <div className="in-app-subscription-sheet hm-sheet-overlay" style={{ background: 'rgba(43,58,103,.35)' }}>
      <div
        className="hm-sheet-panel hm-sheet-panel--wide hm-sheet-panel--scroll"
        style={{ background: cream, padding: '16px 18px 32px' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <button
            type="button"
            aria-label={lang === 'el' ? 'Πίσω' : 'Back'}
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '1px solid rgba(43,58,103,.12)',
              background: '#fff',
              color: navy,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: 0,
              marginTop: 2,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                color: navy,
                letterSpacing: -0.3,
              }}
            >
              {lang === 'el' ? 'Συνδρομή' : 'Subscription'}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(43,58,103,.55)' }}>
              {tSub(`hero.${heroKey}.subtitle`) ||
                (lang === 'el'
                  ? 'Δες τα πακέτα και ποιο είναι ενεργό τώρα.'
                  : 'See plans and which one is active now.')}
            </p>
            {snapshot?.is_trial && snapshot.trial_ends_at ? (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: navy, fontWeight: 600 }}>
                {tSub('hero.trialEnds', {
                  date: formatTrialEnd(snapshot.trial_ends_at, contentLang),
                })}
              </p>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 12px', color: 'rgba(43,58,103,.45)', fontSize: 14 }}>
            {lang === 'el' ? 'Φόρτωση πακέτων…' : 'Loading plans…'}
          </div>
        ) : (
          <div className="pricing-stack" style={{ gap: 12 }}>
            {plans.map((plan, index) => {
              const slot = slotForPlanIndex(index)
              const isCurrent = plan.variant === 'current'
              const trialExpired =
                slot === 'trial' &&
                !!snapshot &&
                !snapshot.subscription_active &&
                snapshot.subscription_status === 'trial'
              return (
                <PlanCard
                  key={`${plan.name}-${index}`}
                  plan={plan}
                  disabled={trialExpired || isCurrent}
                  buttonState={isCurrent ? 'current' : 'idle'}
                  radioSelected={isCurrent}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
