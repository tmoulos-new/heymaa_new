import { buildSafePageContext, type SafePageContext } from './pageContext'
import { canLoadAnalytics, getGtmContainerId } from './env'
import { analyticsCookiesAllowed } from '../cookieConsent'

const GTM_SCRIPT_ID = 'hm-gtm-js'

declare global {
  interface Window {
    // Mixed Arguments objects (gtag queue) and plain event objects.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer: any[]
    gtag?: (...args: unknown[]) => void
  }
}

let consentDefaultsApplied = false
let gtmLoadStarted = false

function ensureDataLayer(): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
}

/**
 * Arguments-object queue wrapper only — never inject gtag/js or GA config from the app.
 */
export function ensureGtagQueue(): void {
  if (typeof window === 'undefined') return
  ensureDataLayer()
  if (typeof window.gtag === 'function') return
  window.gtag = function gtag() {
    // Official snippet queues the Arguments object, not a rest array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments)
  }
}

export function applyConsentDefaultsDenied(): void {
  if (typeof window === 'undefined' || consentDefaultsApplied) return
  ensureGtagQueue()
  window.gtag?.('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  })
  consentDefaultsApplied = true
}

export function setSafeGooglePageContext(ctx: SafePageContext): void {
  if (typeof window === 'undefined') return
  ensureGtagQueue()
  window.gtag?.('set', {
    page_location: ctx.page_location,
    page_path: ctx.page_path,
    page_title: ctx.page_title,
    page_referrer: ctx.page_referrer || undefined,
  })
}

export function updateAnalyticsConsentGranted(): void {
  if (typeof window === 'undefined') return
  ensureGtagQueue()
  window.gtag?.('consent', 'update', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
}

export function updateAnalyticsConsentDenied(): void {
  if (typeof window === 'undefined') return
  if (typeof window.gtag !== 'function') return
  window.gtag('consent', 'update', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
}

function pushGtmStart(_containerId: string): void {
  ensureDataLayer()
  const dl = window.dataLayer as unknown[]
  dl.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
}

/**
 * Idempotent GTM loader. Requires analytics consent + production host + REACT_APP_GTM_ID.
 * Consent grant is queued BEFORE gtm.start / gtm.js.
 */
export function initGoogleTagManager(pathname?: string): boolean {
  if (typeof window === 'undefined') return false
  if (!analyticsCookiesAllowed()) return false
  if (!canLoadAnalytics()) return false

  const containerId = getGtmContainerId()
  if (!containerId) return false

  applyConsentDefaultsDenied()
  const ctx = buildSafePageContext(pathname || window.location.pathname, '')
  setSafeGooglePageContext(ctx)
  updateAnalyticsConsentGranted()

  if (document.getElementById(GTM_SCRIPT_ID) || gtmLoadStarted) {
    return true
  }
  gtmLoadStarted = true

  pushGtmStart(containerId)

  const script = document.createElement('script')
  script.id = GTM_SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`
  document.head.appendChild(script)
  return true
}

/** @deprecated use initGoogleTagManager — kept name for call-site clarity during migration */
export function initGoogleAnalytics(pathname?: string): boolean {
  return initGoogleTagManager(pathname)
}

export function isGtmScriptPresent(): boolean {
  return typeof document !== 'undefined' && Boolean(document.getElementById(GTM_SCRIPT_ID))
}

/**
 * Remove known Google Analytics / Ads linker cookies on common path/domain scopes.
 * Does not touch HeyMaa session/auth cookies.
 */
export function clearGoogleAnalyticsCookies(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const host = window.location.hostname
  const parts = host.split('.').filter(Boolean)
  const domains = new Set<string>(['', host])
  if (parts.length >= 2) {
    domains.add(`.${parts.slice(-2).join('.')}`)
  }
  if (parts.length >= 3) {
    domains.add(`.${parts.slice(-3).join('.')}`)
  }

  const cookieNames = document.cookie
    .split(';')
    .map((c) => c.trim().split('=')[0])
    .filter(Boolean)

  const known = cookieNames.filter(
    (name) =>
      name === '_ga' ||
      name === '_gid' ||
      name === '_gat' ||
      name.startsWith('_ga_') ||
      name.startsWith('_gcl_') ||
      name.startsWith('_gat_'),
  )

  for (const name of known) {
    for (const domain of Array.from(domains)) {
      const domainPart = domain ? `; domain=${domain}` : ''
      document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainPart}`
    }
  }
}

/** Test helpers */
export function resetGtmLoaderForTests(): void {
  consentDefaultsApplied = false
  gtmLoadStarted = false
  if (typeof document !== 'undefined') {
    document.getElementById(GTM_SCRIPT_ID)?.remove()
  }
}
