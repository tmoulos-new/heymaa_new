import type { SubscriptionSnapshot } from './authApi'
import { formatTrialEnd } from './subscriptionPlans'
import { daysUntilTrialEnd } from './appNotifications'

export type AccessExpiryKind = 'trial' | 'grant' | 'mixed' | 'subscription'

export type AccessExpiryInfo = {
  accessEndsAt: string
  daysLeft: number
  urgent: boolean
  endsToday: boolean
  endLabel: string
  kind: AccessExpiryKind
  grantPlanSlot?: string | null
}

const EXPIRY_POPUP_KEY = 'hm_access_expiry_popup_dismissed'

function latestGrantEnd(sub: SubscriptionSnapshot | null): string | null {
  const grants = sub?.active_plan_grants || sub?.rewards?.active_grants || []
  let latest: string | null = null
  for (const g of grants) {
    const end = g.ends_at
    if (!end) continue
    if (!latest || new Date(end).getTime() > new Date(latest).getTime()) {
      latest = end
    }
  }
  return latest
}

function activeGrantPlan(sub: SubscriptionSnapshot | null): string | null {
  const grants = sub?.active_plan_grants || sub?.rewards?.active_grants || []
  const now = Date.now()
  let best: string | null = null
  let bestRank = -1
  const rank: Record<string, number> = { trial: 0, starter: 1, premium: 2, annual: 3 }
  for (const g of grants) {
    const end = g.ends_at ? new Date(g.ends_at).getTime() : 0
    if (end <= now) continue
    const slot = (g.plan_slot || '').toLowerCase()
    const r = rank[slot] ?? 0
    if (r >= bestRank) {
      bestRank = r
      best = slot
    }
  }
  return best
}

/** Unified access expiry — trial, reward grants, or whichever ends later. */
export function getAccessExpiryInfo(
  lang: string,
  trialEndsAt: string | null | undefined,
  sub: SubscriptionSnapshot | null,
): AccessExpiryInfo | null {
  const accessEndsAt =
    sub?.access_ends_at ||
    (() => {
      const trial = trialEndsAt && sub?.is_trial ? trialEndsAt : null
      const grant = latestGrantEnd(sub)
      const subEnd =
        sub?.subscription_ends_at &&
        sub.subscription_status === 'active' &&
        !sub?.is_trial
          ? sub.subscription_ends_at
          : null
      const candidates = [trial, grant, subEnd].filter(Boolean) as string[]
      if (!candidates.length) return null
      return candidates.reduce((a, b) => (new Date(a) >= new Date(b) ? a : b))
    })()

  if (!accessEndsAt) return null

  const trialActive = Boolean(sub?.is_trial && sub.subscription_active && trialEndsAt)
  const grantEnd = latestGrantEnd(sub)
  const grantActive = grantEnd ? new Date(grantEnd).getTime() > Date.now() : false
  const paidActive = Boolean(
    sub?.subscription_status === 'active' && !sub?.is_trial && sub.subscription_active,
  )
  const paidEnd = sub?.subscription_ends_at
  const paidEndActive = paidEnd ? new Date(paidEnd).getTime() > Date.now() : false

  if (!trialActive && !grantActive && !(paidActive && paidEndActive)) {
    if (!paidActive || !sub?.subscription_ends_at) {
      if (!trialActive && !grantActive) return null
    }
  }

  if (paidActive && !trialActive && !grantActive && !sub?.subscription_ends_at) {
    return null
  }

  const days = daysUntilTrialEnd(accessEndsAt)
  const daysLeft = Math.max(0, Math.ceil(days))
  const endLabel = formatTrialEnd(accessEndsAt, lang)

  let kind: AccessExpiryKind = 'trial'
  if (trialActive && grantActive) kind = 'mixed'
  else if (grantActive && !trialActive) kind = 'grant'
  else if (paidEndActive && !trialActive && !grantActive) kind = 'subscription'

  return {
    accessEndsAt,
    daysLeft,
    urgent: days <= 2,
    endsToday: days <= 0,
    endLabel,
    kind,
    grantPlanSlot: activeGrantPlan(sub),
  }
}

export function expiryPopupDismissKey(accessEndsAt: string): string {
  return `${EXPIRY_POPUP_KEY}_${accessEndsAt.slice(0, 10)}`
}

export function readExpiryPopupDismissed(accessEndsAt: string): boolean {
  try {
    return sessionStorage.getItem(expiryPopupDismissKey(accessEndsAt)) === '1'
  } catch {
    return false
  }
}

export function dismissExpiryPopup(accessEndsAt: string): void {
  try {
    sessionStorage.setItem(expiryPopupDismissKey(accessEndsAt), '1')
  } catch {
    /* ignore */
  }
}

export function expiryPopupCopy(info: AccessExpiryInfo, lang: string): {
  title: string
  body: string
  cta: string
} {
  const isEl = lang === 'el'
  const plan =
    info.grantPlanSlot === 'premium'
      ? 'Premium'
      : info.grantPlanSlot === 'starter'
        ? 'Starter'
        : null

  if (info.endsToday) {
    return {
      title: isEl ? 'Η πρόσβασή σου λήγει σήμερα' : 'Your access ends today',
      body: isEl
        ? `Η πρόσβαση στην HeyMaa λήγει σήμερα (${info.endLabel}). Ανανέωσε ή αναβάθμισε το πλάνο σου για να συνεχίσεις.`
        : `Your HeyMaa access ends today (${info.endLabel}). Renew or upgrade your plan to continue.`,
      cta: isEl ? 'Ανανέωση / Upgrade' : 'Renew / Upgrade',
    }
  }

  if (info.kind === 'grant' && plan) {
    return {
      title: isEl
        ? `Το δωρεάν ${plan} λήγει σε ${info.daysLeft} ${info.daysLeft === 1 ? 'ημέρα' : 'ημέρες'}`
        : `Free ${plan} ends in ${info.daysLeft} day${info.daysLeft === 1 ? '' : 's'}`,
      body: isEl
        ? `Το δωρεάν πλάνο ${plan} από την ανταμοιβή επίπεδου λήγει ${info.endLabel}. Ανανέωσε ή αναβάθμισε για απρόσκοπτη πρόσβαση.`
        : `Your free ${plan} level reward ends ${info.endLabel}. Renew or upgrade for uninterrupted access.`,
      cta: isEl ? 'Δες πλάνα' : 'View plans',
    }
  }

  return {
    title: isEl
      ? `Απομένουν ${info.daysLeft} ${info.daysLeft === 1 ? 'ημέρα' : 'ημέρες'}`
      : `${info.daysLeft} day${info.daysLeft === 1 ? '' : 's'} left`,
    body: isEl
      ? `Η πρόσβασή σου λήγει ${info.endLabel}. Επίλεξε ή ανανέωσε πλάνο πριν λήξει.`
      : `Your access ends ${info.endLabel}. Choose or renew a plan before it expires.`,
    cta: isEl ? 'Ανανέωση / Upgrade' : 'Renew / Upgrade',
  }
}
