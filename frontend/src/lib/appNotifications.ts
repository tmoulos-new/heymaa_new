import type { SubscriptionSnapshot } from './authApi'
import { formatTrialEnd } from './subscriptionPlans'

export type AppNotificationAction = 'subscription' | 'subscription_sheet'

export type AppNotification = {
  id: string
  title: string
  body: string
  actionLabel?: string
  action?: AppNotificationAction
  urgent?: boolean
}

const READ_KEY_PREFIX = 'hm_notif_read_'

export function daysUntilTrialEnd(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
}

function daysUntil(iso: string): number {
  return daysUntilTrialEnd(iso)
}

export type TrialBannerInfo = {
  daysLeft: number
  endLabel: string
  urgent: boolean
  endsToday: boolean
}

export function getTrialBannerInfo(
  lang: string,
  trialEndsAt: string | null | undefined,
  sub: SubscriptionSnapshot | null,
): TrialBannerInfo | null {
  const trialActive =
    Boolean(sub?.is_trial && sub.subscription_active) ||
    Boolean(trialEndsAt && !sub)

  if (!trialEndsAt || !trialActive) return null

  const days = daysUntilTrialEnd(trialEndsAt)
  const daysLeft = Math.max(0, Math.ceil(days))
  const endLabel = formatTrialEnd(trialEndsAt, lang)

  return {
    daysLeft,
    endLabel,
    urgent: days <= 2,
    endsToday: days <= 0,
  }
}

export function buildAppNotifications(
  lang: string,
  trialEndsAt: string | null | undefined,
  sub: SubscriptionSnapshot | null,
): AppNotification[] {
  const isEl = lang === 'el'
  const items: AppNotification[] = []

  const trialActive =
    Boolean(sub?.is_trial && sub.subscription_active) ||
    Boolean(trialEndsAt && !sub)
  const status = (sub?.subscription_status || '').toLowerCase()
  const trialExpired =
    status === 'trial' && sub && !sub.subscription_active

  if (trialEndsAt && trialActive) {
    const days = daysUntil(trialEndsAt)
    const endLabel = formatTrialEnd(trialEndsAt, lang)
    const roundedDays = Math.max(0, Math.ceil(days))

    if (days <= 0) {
      items.push({
        id: `trial_today_${trialEndsAt}`,
        title: isEl ? 'Η δοκιμή λήγει σήμερα' : 'Trial ends today',
        body: isEl
          ? `Η δωρεάν δοκιμή σου λήγει σήμερα (${endLabel}). Επίλεξε πακέτο για να συνεχίσεις την HeyMaa.`
          : `Your free trial ends today (${endLabel}). Choose a plan to keep using HeyMaa.`,
        actionLabel: isEl ? 'Επιλογή πακέτου' : 'Select plan',
        action: 'subscription',
        urgent: true,
      })
    } else if (days <= 2) {
      items.push({
        id: `trial_soon_${trialEndsAt}`,
        title: isEl
          ? `Η δοκιμή λήγει σε ${roundedDays} ${roundedDays === 1 ? 'ημέρα' : 'ημέρες'}`
          : `Trial ends in ${roundedDays} day${roundedDays === 1 ? '' : 's'}`,
        body: isEl
          ? `Η δωρεάν δοκιμή σου λήγει ${endLabel}. Επίλεξε πακέτο πριν λήξει η πρόσβαση.`
          : `Your free trial ends ${endLabel}. Pick a plan before access ends.`,
        actionLabel: isEl ? 'Επιλογή πακέτου' : 'Select plan',
        action: 'subscription',
        urgent: true,
      })
    } else if (days <= 7) {
      items.push({
        id: `trial_week_${trialEndsAt}`,
        title: isEl
          ? `Απομένουν ${roundedDays} ημέρες δοκιμής`
          : `${roundedDays} days left on your trial`,
        body: isEl
          ? `Η δοκιμή σου λήγει ${endLabel}. Δες τα διαθέσιμα πακέτα όποτε θέλεις.`
          : `Your trial ends ${endLabel}. Browse plans whenever you are ready.`,
        actionLabel: isEl ? 'Δες τα πακέτα' : 'View plans',
        action: 'subscription_sheet',
      })
    } else {
      items.push({
        id: `trial_active_${trialEndsAt}`,
        title: isEl ? 'Δωρεάν δοκιμή ενεργή' : 'Free trial active',
        body: isEl
          ? `Απολαμβάνεις δωρεάν πρόσβαση μέχρι ${endLabel}.`
          : `You have free access until ${endLabel}.`,
        actionLabel: isEl ? 'Δες τα πακέτα' : 'View plans',
        action: 'subscription_sheet',
      })
    }
  }

  if (trialExpired) {
    items.push({
      id: 'trial_expired',
      title: isEl ? 'Η δωρεάν δοκιμή έληξε' : 'Free trial ended',
      body: isEl
        ? 'Η δοκιμή σου έχει λήξει. Ανανέωσε τη συνδρομή σου για να συνεχίσεις.'
        : 'Your trial has ended. Renew your subscription to continue.',
      actionLabel: isEl ? 'Επιλογή πακέτου' : 'Select plan',
      action: 'subscription',
      urgent: true,
    })
  } else if (sub && !sub.subscription_active && !sub.is_trial && status !== 'trial') {
    items.push({
      id: 'subscription_inactive',
      title: isEl ? 'Η συνδρομή δεν είναι ενεργή' : 'Subscription inactive',
      body: isEl
        ? 'Η συνδρομή σου δεν είναι ενεργή. Επίλεξε πακέτο για πλήρη πρόσβαση.'
        : 'Your subscription is not active. Choose a plan for full access.',
      actionLabel: isEl ? 'Ανανέωση' : 'Renew',
      action: 'subscription',
      urgent: true,
    })
  }

  return items
}

function readStorageKey(token: string) {
  return `${READ_KEY_PREFIX}${token}`
}

export function readNotificationIds(token: string): Set<string> {
  try {
    const raw = localStorage.getItem(readStorageKey(token))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function writeNotificationIds(token: string, ids: Set<string>) {
  try {
    localStorage.setItem(readStorageKey(token), JSON.stringify(Array.from(ids)))
  } catch {
    /* ignore */
  }
}

export function markNotificationsRead(token: string, ids: string[]) {
  const set = readNotificationIds(token)
  ids.forEach((id) => set.add(id))
  writeNotificationIds(token, set)
}
