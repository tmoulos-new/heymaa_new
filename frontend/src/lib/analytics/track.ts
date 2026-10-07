import { analyticsCookiesAllowed } from '../cookieConsent'
import { canLoadAnalytics } from './env'
import { ensureDataLayerPushReady, isDispatchEnabled, setDispatchEnabled } from './dispatch'
import {
  buildSafePageContext,
  commitPageViewContext,
  type SafePageContext,
} from './pageContext'
import { analyticsPlanItem } from './plans'
import { setSafeGooglePageContext } from './gtm'

export type { SafePageContext }

const ALLOWED_EVENTS = new Set([
  'page_view',
  'sign_up',
  'login',
  'begin_checkout',
] as const)

type AllowedEvent = 'page_view' | 'sign_up' | 'login' | 'begin_checkout'

type EcommerceItem = {
  item_id: string
  item_name: string
  price: number
  quantity: number
}

function pushEvent(event: AllowedEvent, fields: Record<string, unknown>): boolean {
  if (!ALLOWED_EVENTS.has(event)) return false
  // Recheck consent on every call — never queue for later replay.
  if (!analyticsCookiesAllowed()) return false
  if (!isDispatchEnabled()) return false
  if (!canLoadAnalytics()) return false
  if (typeof window === 'undefined') return false

  ensureDataLayerPushReady()
  const ctx = (fields as { __ctx?: SafePageContext }).__ctx
  const context =
    ctx ||
    buildSafePageContext(
      typeof window !== 'undefined' ? window.location.pathname : '/',
      '',
    )
  setSafeGooglePageContext(context)

  const payload: Record<string, unknown> = {
    event,
    page_location: context.page_location,
    page_path: context.page_path,
    page_title: context.page_title,
    page_referrer: context.page_referrer,
  }

  for (const [k, v] of Object.entries(fields)) {
    if (k === '__ctx' || k === 'event') continue
    if (k === 'ecommerce' || k === 'method') {
      payload[k] = v
      continue
    }
    // No other arbitrary params
  }

  window.dataLayer.push(payload)
  return true
}

export function trackPageView(pathname: string, search = ''): boolean {
  const ctx = buildSafePageContext(pathname, search)
  const ok = pushEvent('page_view', { __ctx: ctx })
  if (ok) commitPageViewContext(ctx)
  return ok
}

export function trackSignUp(method: 'email' = 'email'): boolean {
  if (method !== 'email') return false
  return pushEvent('sign_up', { method: 'email' })
}

export function trackLogin(method: 'email' = 'email'): boolean {
  if (method !== 'email') return false
  return pushEvent('login', { method: 'email' })
}

/**
 * Fire once when Viva checkout URL is about to open.
 * `amountCents` from `/checkout/viva` (e.g. 1399 → €13.99).
 */
export function trackBeginCheckout(plan: string, amountCents: number): boolean {
  const item = analyticsPlanItem(plan, amountCents)
  if (!item) return false
  if (!analyticsCookiesAllowed() || !isDispatchEnabled() || !canLoadAnalytics()) return false
  if (typeof window === 'undefined') return false

  ensureDataLayerPushReady()
  const ctx = buildSafePageContext(window.location.pathname, '')
  setSafeGooglePageContext(ctx)

  // Clear prior ecommerce object before each ecommerce event.
  window.dataLayer.push({ ecommerce: null })

  const items: EcommerceItem[] = [
    {
      item_id: item.item_id,
      item_name: item.item_name,
      price: item.price,
      quantity: 1,
    },
  ]

  window.dataLayer.push({
    event: 'begin_checkout',
    page_location: ctx.page_location,
    page_path: ctx.page_path,
    page_title: ctx.page_title,
    page_referrer: ctx.page_referrer,
    ecommerce: {
      currency: 'EUR',
      value: item.price,
      items,
    },
  })
  return true
}

/**
 * Fire once after `/checkout/viva/verify` confirms payment for this user.
 * `transactionId` is the Viva transaction id; `amountCents` from verify response.
 */
export function trackPurchase(
  plan: string,
  amountCents: number,
  transactionId: string,
): boolean {
  const item = analyticsPlanItem(plan, amountCents)
  const tid = (transactionId || '').trim()
  if (!item || !tid) return false
  if (!analyticsCookiesAllowed() || !isDispatchEnabled() || !canLoadAnalytics()) return false
  if (typeof window === 'undefined') return false

  const dedupeKey = `hm_purchase_tracked_${tid}`
  try {
    if (sessionStorage.getItem(dedupeKey) === '1') return false
  } catch {
    /* ignore */
  }

  ensureDataLayerPushReady()
  const ctx = buildSafePageContext(window.location.pathname, '')
  setSafeGooglePageContext(ctx)

  window.dataLayer.push({ ecommerce: null })

  const items: EcommerceItem[] = [
    {
      item_id: item.item_id,
      item_name: item.item_name,
      price: item.price,
      quantity: 1,
    },
  ]

  window.dataLayer.push({
    event: 'purchase',
    page_location: ctx.page_location,
    page_path: ctx.page_path,
    page_title: ctx.page_title,
    page_referrer: ctx.page_referrer,
    ecommerce: {
      transaction_id: tid,
      currency: 'EUR',
      value: item.price,
      items,
    },
  })

  try {
    sessionStorage.setItem(dedupeKey, '1')
  } catch {
    /* ignore */
  }
  return true
}

export { setDispatchEnabled, isDispatchEnabled }
