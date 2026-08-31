import type { HomePlan } from '../i18n/homeTypes'
import type { SubscriptionSnapshot } from './authApi'

export type PlanSlot = 'trial' | 'starter' | 'premium' | 'annual'

export const PLAN_SLOTS: PlanSlot[] = ['trial', 'starter', 'premium', 'annual']

export function slotForPlanIndex(index: number): PlanSlot {
  return PLAN_SLOTS[index] ?? 'trial'
}

export function slotForPaidPlan(plan?: string | null): PlanSlot | null {
  const p = (plan || '').toLowerCase()
  if (p.includes('annual') || p.includes('year') || p.includes('ετήσ')) return 'annual'
  if (p.includes('premium')) return 'premium'
  if (p.includes('starter')) return 'starter'
  return null
}

export function indexForPlanSlot(slot: PlanSlot): number {
  const index = PLAN_SLOTS.indexOf(slot)
  return index >= 0 ? index : 0
}

function isFreePlanName(plan?: string | null): boolean {
  const p = (plan || '').trim().toLowerCase()
  if (!p) return false
  return p === 'free' || p === 'trial' || p.startsWith('free ') || p.includes('δωρεάν')
}

function slotFromEntitlements(snapshot: SubscriptionSnapshot): PlanSlot | null {
  const slot = (snapshot.entitlements?.plan_slot || '').toLowerCase()
  if (slot === 'trial' || slot === 'starter' || slot === 'premium' || slot === 'annual') {
    return slot
  }
  return slotForPaidPlan(slot)
}

export function resolveCurrentPlanSlot(
  snapshot: SubscriptionSnapshot | null,
): PlanSlot | null {
  if (!snapshot) return null

  const entSlot = slotFromEntitlements(snapshot)
  if (snapshot.subscription_active && entSlot && entSlot !== 'trial') return entSlot

  const status = (snapshot.subscription_status || '').toLowerCase()
  const planRaw = (snapshot.plan || '').toLowerCase()

  if (
    snapshot.is_trial ||
    status === 'trial' ||
    planRaw === 'trial' ||
    isFreePlanName(snapshot.plan)
  ) {
    return 'trial'
  }

  const paidSlot = slotForPaidPlan(snapshot.plan)
  if (paidSlot && snapshot.subscription_active) return paidSlot

  if (entSlot === 'trial') return 'trial'

  if (status === 'active' && snapshot.subscription_active) return 'starter'

  return 'trial'
}

/** Slot to highlight on plan cards. Defaults to the free trial when unknown. */
export function displaySelectedPlanSlot(
  snapshot: SubscriptionSnapshot | null,
): PlanSlot {
  return resolveCurrentPlanSlot(snapshot) ?? 'trial'
}

export function activePlanNameForSlot(
  slot: PlanSlot,
  plans: HomePlan[],
  lang: string,
): string {
  const index = PLAN_SLOTS.indexOf(slot)
  const plan = plans[index]
  if (plan?.name) return plan.name
  const fallbacks: Record<PlanSlot, { el: string; en: string }> = {
    trial: { el: 'Δωρεάν Δοκιμή', en: 'Free trial' },
    starter: { el: 'Starter', en: 'Starter' },
    premium: { el: 'Premium', en: 'Premium' },
    annual: { el: 'Ετήσιο Premium', en: 'Annual Premium' },
  }
  return lang === 'el' ? fallbacks[slot].el : fallbacks[slot].en
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
    const selectedSlot = displaySelectedPlanSlot(null)
    if (hasToken) {
      return plans.map((plan, index) => {
        const slot = slotForPlanIndex(index)
        if (slot === selectedSlot) {
          return {
            ...plan,
            variant: 'current',
            featured: true,
            badge: labels.currentBadge,
            badgeColor: '#2B3A67',
            button: labels.currentButton,
            buttonClass: 'btn-plan-current',
          }
        }
        return {
          ...plan,
          variant:
            plan.variant === 'current' || plan.variant === 'trial' ? '' : plan.variant,
          featured: false,
        }
      })
    }
    return plans.map((plan, index) => {
      if (slotForPlanIndex(index) !== selectedSlot) {
        return { ...plan, featured: false }
      }
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

  const { subscription_status } = snapshot
  const status = (subscription_status || '').toLowerCase()
  const trialExpired = status === 'trial' && !snapshot.subscription_active
  const currentSlot = displaySelectedPlanSlot(snapshot)

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
