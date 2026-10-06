import { writeCookieConsent } from '../cookieConsent'
import { setDispatchEnabled } from './dispatch'
import { clearGoogleAnalyticsCookies, updateAnalyticsConsentDenied } from './gtm'

/**
 * Persist essential-only, stop dispatch immediately, deny Consent Mode if loaded,
 * clear known GA cookies, then reload so the old container cannot continue.
 */
export function revokeAnalyticsAndReload(): void {
  setDispatchEnabled(false)
  writeCookieConsent(false)
  try {
    updateAnalyticsConsentDenied()
  } catch {
    /* ignore */
  }
  try {
    clearGoogleAnalyticsCookies()
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}
