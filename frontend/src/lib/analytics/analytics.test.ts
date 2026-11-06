/**
 * @jest-environment jsdom
 */
import {
  ANALYTICS_CHECKOUT_PLANS,
  analyticsPlanItem,
  applyConsentDefaultsDenied,
  buildSafePageContext,
  canLoadAnalytics,
  initGoogleTagManager,
  isAnalyticsHostAllowed,
  pageTitleForPath,
  resetGtmLoaderForTests,
  resetPageContextForTests,
  sanitizeAbsoluteUrl,
  sanitizePathname,
  sanitizeReferrer,
  setDispatchEnabled,
  shouldSkipPageViewPath,
  trackBeginCheckout,
  trackLogin,
  trackPageView,
  trackPurchase,
  trackSignUp,
} from './index'
import { COOKIE_CONSENT_KEY, writeCookieConsent } from '../cookieConsent'

function mockHost(hostname: string, href = `https://${hostname}/`) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      hostname,
      href,
      origin: `https://${hostname}`,
      pathname: new URL(href).pathname,
      search: new URL(href).search,
      protocol: 'https:',
      reload: jest.fn(),
    },
  })
}

describe('analytics host gating', () => {
  const prev = process.env.REACT_APP_GTM_ID
  afterEach(() => {
    process.env.REACT_APP_GTM_ID = prev
  })

  it('allows only www.heymaa.ai', () => {
    expect(isAnalyticsHostAllowed('www.heymaa.ai')).toBe(true)
    expect(isAnalyticsHostAllowed('heymaa.ai')).toBe(false)
    expect(isAnalyticsHostAllowed('localhost')).toBe(false)
    expect(isAnalyticsHostAllowed('heymaa-git-main.vercel.app')).toBe(false)
    expect(isAnalyticsHostAllowed('staging.heymaa.ai')).toBe(false)
  })

  it('requires GTM id env even on production host', () => {
    mockHost('www.heymaa.ai')
    process.env.REACT_APP_GTM_ID = ''
    expect(canLoadAnalytics()).toBe(false)
    process.env.REACT_APP_GTM_ID = 'GTM-N39D5NBV'
    expect(canLoadAnalytics()).toBe(true)
  })
})

describe('URL sanitization', () => {
  it('strips query and hash by default', () => {
    expect(sanitizePathname('/checkout/success?t=SECRET&gift=ABC#x')).toBe('/checkout/success')
    expect(sanitizeAbsoluteUrl('https://www.heymaa.ai/app?reset=tok')).toBe(
      'https://www.heymaa.ai/app',
    )
  })

  it('keeps utm_* / click ids when asked', () => {
    expect(
      sanitizeAbsoluteUrl(
        'https://www.heymaa.ai/?utm_source=SMS&utm_medium=SMS&utm_campaign=Natal&gift=SECRET',
        undefined,
        { keepAttribution: true },
      ),
    ).toBe('https://www.heymaa.ai/?utm_source=SMS&utm_medium=SMS&utm_campaign=Natal')
    expect(
      sanitizeAbsoluteUrl('https://www.heymaa.ai/app', undefined, {
        search: '?utm_source=Email&utm_medium=Email&utm_campaign=Natal&t=TXSECRET',
      }),
    ).toBe('https://www.heymaa.ai/app?utm_source=Email&utm_medium=Email&utm_campaign=Natal')
  })

  it('templates uuid-like segments', () => {
    expect(sanitizePathname('/app/550e8400-e29b-41d4-a716-446655440000')).toBe('/app/:id')
  })

  it('uses static titles', () => {
    expect(pageTitleForPath('/checkout?plan=premium')).toBe('HeyMaa — Checkout')
    expect(pageTitleForPath('/unknown')).toBe('HeyMaa')
  })

  it('sanitizes external referrer', () => {
    expect(sanitizeReferrer('https://google.com/search?q=pregnancy+heymaa')).toBe(
      'https://google.com/search',
    )
  })

  it('skips redirect-only paths', () => {
    expect(shouldSkipPageViewPath('/', '', true)).toBe(true)
    expect(shouldSkipPageViewPath('/', '?reset=1', false)).toBe(true)
    expect(shouldSkipPageViewPath('/auth', '', false)).toBe(true)
    expect(shouldSkipPageViewPath('/', '', false)).toBe(false)
  })
})

describe('consent and event dispatch', () => {
  const prev = process.env.REACT_APP_GTM_ID

  beforeEach(() => {
    process.env.REACT_APP_GTM_ID = 'GTM-N39D5NBV'
    mockHost('www.heymaa.ai', 'https://www.heymaa.ai/subscription')
    localStorage.clear()
    sessionStorage.clear()
    document.head.innerHTML = ''
    window.dataLayer = []
    resetGtmLoaderForTests()
    resetPageContextForTests()
    setDispatchEnabled(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).gtag
  })

  afterEach(() => {
    process.env.REACT_APP_GTM_ID = prev
  })

  it('does not load GTM before consent', () => {
    applyConsentDefaultsDenied()
    expect(initGoogleTagManager('/')).toBe(false)
    expect(document.getElementById('hm-gtm-js')).toBeNull()
    expect(trackPageView('/')).toBe(false)
  })

  it('loads GTM once after accept and queues consent before gtm.js', () => {
    writeCookieConsent(true)
    const ok = initGoogleTagManager('/subscription')
    expect(ok).toBe(true)
    expect(document.getElementById('hm-gtm-js')).toBeTruthy()
    expect(initGoogleTagManager('/subscription')).toBe(true)
    expect(document.querySelectorAll('#hm-gtm-js').length).toBe(1)

    const dl = window.dataLayer as unknown[]
    // consent default + set + consent update + gtm.start should appear
    const asText = dl.map((x) => {
      if (x && typeof x === 'object' && 'event' in (x as object)) return JSON.stringify(x)
      try {
        return JSON.stringify(Array.from(x as ArrayLike<unknown>))
      } catch {
        return String(x)
      }
    }).join('\n')
    expect(asText).toContain('analytics_storage')
    expect(asText).toContain('gtm.js')
  })

  it('never queues events without consent even if dispatch flagged', () => {
    writeCookieConsent(false)
    setDispatchEnabled(true)
    expect(trackSignUp('email')).toBe(false)
    expect(trackLogin('email')).toBe(false)
    expect(window.dataLayer.filter((x) => x && (x as { event?: string }).event === 'sign_up')).toHaveLength(0)
  })

  it('emits page_view with sanitized context after grant', () => {
    writeCookieConsent(true)
    initGoogleTagManager('/checkout/success')
    setDispatchEnabled(true)
    mockHost('www.heymaa.ai', 'https://www.heymaa.ai/checkout/success?t=TXSECRET')
    expect(trackPageView('/checkout/success', '?t=TXSECRET')).toBe(true)
    const ev = [...window.dataLayer]
      .reverse()
      .find((x) => x && (x as { event?: string }).event === 'page_view') as Record<string, string>
    expect(ev.page_path).toBe('/checkout/success')
    expect(ev.page_location).toBe('https://www.heymaa.ai/checkout/success')
    expect(String(ev.page_location)).not.toContain('TXSECRET')
    expect(ev.page_title).toBe('HeyMaa — Checkout success')
  })

  it('emits begin_checkout ecommerce in major EUR units', () => {
    writeCookieConsent(true)
    initGoogleTagManager('/checkout')
    setDispatchEnabled(true)
    expect(trackBeginCheckout('premium', 2499)).toBe(true)
    const clears = window.dataLayer.filter((x) => x && (x as { ecommerce?: unknown }).ecommerce === null)
    expect(clears.length).toBeGreaterThanOrEqual(1)
    const ev = [...window.dataLayer]
      .reverse()
      .find((x) => x && (x as { event?: string }).event === 'begin_checkout') as {
      ecommerce: { currency: string; value: number; items: { item_id: string; price: number }[] }
    }
    expect(ev.ecommerce.currency).toBe('EUR')
    expect(ev.ecommerce.value).toBe(24.99)
    expect(ev.ecommerce.items[0].item_id).toBe('premium')
    expect(ev.ecommerce.items[0].price).toBe(24.99)
  })

  it('emits purchase ecommerce after verified payment fields', () => {
    writeCookieConsent(true)
    initGoogleTagManager('/checkout/success')
    setDispatchEnabled(true)
    expect(trackPurchase('premium', 2499, 'TX-123')).toBe(true)
    expect(trackPurchase('premium', 2499, 'TX-123')).toBe(false) // session dedupe
    const ev = [...window.dataLayer]
      .reverse()
      .find((x) => x && (x as { event?: string }).event === 'purchase') as {
      ecommerce: {
        transaction_id: string
        currency: string
        value: number
        items: { item_id: string; price: number }[]
      }
    }
    expect(ev.ecommerce.transaction_id).toBe('TX-123')
    expect(ev.ecommerce.currency).toBe('EUR')
    expect(ev.ecommerce.value).toBe(24.99)
    expect(ev.ecommerce.items[0].item_id).toBe('premium')
  })

  it('plan catalog matches Viva major amounts', () => {
    expect(ANALYTICS_CHECKOUT_PLANS.starter.price).toBe(13.99)
    expect(ANALYTICS_CHECKOUT_PLANS.premium.price).toBe(24.99)
    expect(ANALYTICS_CHECKOUT_PLANS.annual.price).toBe(119.99)
    expect(analyticsPlanItem('starter', 1399)?.price).toBe(13.99)
  })

  it('keeps stored consent decisions readable', () => {
    writeCookieConsent(true)
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY)
    expect(raw).toContain('"analytics":true')
    writeCookieConsent(false)
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toContain('"analytics":false')
  })

  it('builds page context without raw secrets but with UTMs', () => {
    const secret = buildSafePageContext('/app', '?gift=SECRET')
    expect(secret.page_path).toBe('/app')
    expect(secret.page_location).not.toContain('gift')

    const utm = buildSafePageContext(
      '/',
      '?utm_source=Email&utm_medium=Email&utm_campaign=Natal&gift=SECRET',
    )
    expect(utm.page_location).toContain('utm_source=Email')
    expect(utm.page_location).toContain('utm_campaign=Natal')
    expect(utm.page_location).not.toContain('gift')
  })
})
