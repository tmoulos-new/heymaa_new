import type { NavigateFunction } from 'react-router-dom'
import { HM_TOKEN_KEY } from './authApi'
import { APP_ROUTE } from '../publicRoutes'
import { goToVivaCheckout, vivaPlanForVariant, type VivaPlanKey } from './vivaCheckout'

export const PLAN_INTENT_KEY = 'hm_intent_plan'

export function setPlanIntent(variant: string): void {
  try {
    sessionStorage.setItem(PLAN_INTENT_KEY, variant || 'trial')
  } catch {
    /* ignore quota errors */
  }
}

export function readPlanIntent(): string | null {
  try {
    return sessionStorage.getItem(PLAN_INTENT_KEY)
  } catch {
    return null
  }
}

export function clearPlanIntent(): void {
  try {
    sessionStorage.removeItem(PLAN_INTENT_KEY)
  } catch {
    /* ignore */
  }
}

export function hasAuthToken(): boolean {
  return !!localStorage.getItem(HM_TOKEN_KEY)
}

/**
 * Classic SaaS funnel: remember plan → sign up / sign in if needed → checkout or app.
 */
export function continueWithPlan(variant: string, navigate: NavigateFunction): void {
  const normalized = variant || 'trial'
  setPlanIntent(normalized)

  const checkoutPlan = vivaPlanForVariant(normalized)
  if (!checkoutPlan) {
    if (!hasAuthToken()) {
      navigate(`${APP_ROUTE}/auth`)
      return
    }
    clearPlanIntent()
    navigate(APP_ROUTE)
    return
  }

  if (!hasAuthToken()) {
    navigate(`${APP_ROUTE}/auth`)
    return
  }

  clearPlanIntent()
  goToVivaCheckout(checkoutPlan)
}

/** Resume after successful auth (signup or login). */
export function resumePlanAfterAuth(navigate: NavigateFunction): void {
  const intent = readPlanIntent()
  const checkoutPlan = intent ? vivaPlanForVariant(intent) : null
  if (checkoutPlan) {
    clearPlanIntent()
    goToVivaCheckout(checkoutPlan)
    return
  }
  clearPlanIntent()
  navigate(APP_ROUTE, { replace: true })
}

/** Paid checkout entry — requires auth; stores intent when missing. */
export function startPaidCheckout(plan: VivaPlanKey, navigate: NavigateFunction): void {
  setPlanIntent(plan)
  if (!hasAuthToken()) {
    navigate(`${APP_ROUTE}/auth`)
    return
  }
  clearPlanIntent()
  goToVivaCheckout(plan)
}
