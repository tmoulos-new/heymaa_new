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
    if (k === 'ecommerce' || k === 'method' || k === 'channel') {
      payload[k] = v
      continue
    }
    // No other arbitrary params
  }

  window.dataLayer.push(payload)
  return true
}

type FbqFn = ((...args: unknown[]) => void) & { queue?: unknown[] }

function getFbq(): FbqFn | undefined {
  if (typeof window === 'undefined') return undefined
  const fbq = (window as Window & { fbq?: FbqFn }).fbq
  return typeof fbq === 'function' ? fbq : undefined
}

/**
 * Meta Pixel conversion for signup.
 * - CompleteRegistration → FB ad set optimization
 * - Subscribe → IG ad set still optimized on Website Subscribe
 * Retries briefly because GTM often injects fbq after signup paints.
 * Also pushes dataLayer `complete_registration` for a GTM→Pixel tag fallback.
 */
function trackMetaSignupConversions(channel?: string): void {
  if (typeof window === 'undefined') return

  const ch = channel ? String(channel).slice(0, 40) : undefined
  const eventId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `hm_reg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  try {
    const dedupeKey = 'hm_meta_signup_pixel'
    if (sessionStorage.getItem(dedupeKey) === '1') return
    sessionStorage.setItem(dedupeKey, '1')
  } catch {
    /* ignore */
  }

  // GTM Custom Event trigger can map this → Meta Pixel tag if fbq is late/missing.
  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'complete_registration',
      method: 'email',
      ...(ch ? { channel: ch } : {}),
      event_id: eventId,
    })
  } catch {
    /* ignore */
  }

  const payload = {
    content_name: 'heymaa_signup',
    status: true,
    ...(ch ? { channel: ch } : {}),
  }

  const fire = (): boolean => {
    const fbq = getFbq()
    if (!fbq) return false
    try {
      fbq('track', 'CompleteRegistration', payload, { eventID: eventId })
      // Keep IG Kickoff OA (Website Subscribe) attributing until ad set is retargeted.
      fbq('track', 'Subscribe', payload, { eventID: `${eventId}_sub` })
      return true
    } catch {
      return false
    }
  }

  if (fire()) return
  let attempts = 0
  const timer = window.setInterval(() => {
    attempts += 1
    if (fire() || attempts >= 40) window.clearInterval(timer)
  }, 250)
}

export function trackPageView(pathname: string, search = ''): boolean {
  const ctx = buildSafePageContext(pathname, search)
  const ok = pushEvent('page_view', { __ctx: ctx })
  if (ok) commitPageViewContext(ctx)
  return ok
}

export function trackSignUp(
  method: 'email' = 'email',
  extra?: { channel?: string },
): boolean {
  if (method !== 'email') return false
  const params: Record<string, string> = { method: 'email' }
  if (extra?.channel) params.channel = String(extra.channel).slice(0, 40)
  const ok = pushEvent('sign_up', params)
  if (ok) trackMetaSignupConversions(extra?.channel)
  return ok
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
