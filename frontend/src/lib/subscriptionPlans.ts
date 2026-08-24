import type { HomePlan } from '../i18n/homeTypes'
import type { SubscriptionSnapshot } from './authApi'

export type PlanSlot = 'trial' | 'starter' | 'premium' | 'annual'

export const PLAN_SLOTS: PlanSlot[] = ['trial', 'starter', 'premium', 'annual']

export function slotForPlanIndex(index: number): PlanSlot {
  return PLAN_SLOTS[index] ?? 'trial'
}

export function slotForPaidPlan(plan?: string | null): PlanSlot | null {
  const p = (plan || '').toLowerCase()
  if (p.includes('annual') || p.includes('year')) return 'annual'
  if (p.includes('premium')) return 'premium'
  if (p.includes('starter')) return 'starter'
  return null
}

export function formatTrialEnd(iso: string, locale: string): string {
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

export function applySubscriptionPlanState(
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
        plan.variant === 'current' || plan.variant === 'trial'
          ? { ...plan, variant: '', badge: '', badgeColor: '', featured: false }
          : { ...plan, featured: !!plan.featured },
      )
    }
    return plans.map((plan, index) => {
      if (slotForPlanIndex(index) !== 'trial') return plan
      return {
        ...plan,
        variant: '',
        badge: '',
        badgeColor: '',
        featured: false,
        button: labels.signupButton,
        buttonClass: 'btn-plan-outline',
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

  return plans.map((planItem, index) => {
    const slot = slotForPlanIndex(index)
    const base = {
      ...planItem,
      variant:
        planItem.variant === 'current' || planItem.variant === 'trial'
          ? ''
          : planItem.variant,
    }

    if (slot === 'trial' && trialExpired) {
      return {
        ...base,
        variant: '',
        featured: false,
        badge: labels.expiredBadge,
        badgeColor: '#E07B54',
        button: labels.expiredButton,
        buttonClass: 'btn-plan-outline',
      }
    }

    if (currentSlot === slot) {
      return {
        ...base,
        variant: 'current',
        featured: true,
        badge: labels.currentBadge,
        badgeColor: '#2B3A67',
        button: labels.currentButton,
        buttonClass: 'btn-plan-current',
      }
    }

    return { ...base, featured: false }
  })
}
