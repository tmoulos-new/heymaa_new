export const COOKIE_CONSENT_KEY = 'hm_cookie_consent_v1'

export type CookieConsent = {
  necessary: true
  analytics: boolean
  decidedAt: string
}

export function readCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CookieConsent
    if (parsed && parsed.necessary === true && typeof parsed.analytics === 'boolean') {
      return parsed
    }
  } catch {
    /* ignore */
  }
  return null
}

export function writeCookieConsent(analytics: boolean): CookieConsent {
  const value: CookieConsent = {
    necessary: true,
    analytics,
    decidedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(value))
  } catch {
    /* ignore */
  }
  return value
}

export function hasCookieConsentDecision(): boolean {
  return readCookieConsent() != null
}

export function analyticsCookiesAllowed(): boolean {
  return readCookieConsent()?.analytics === true
}
