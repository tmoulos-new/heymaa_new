export {
  applyConsentDefaultsDenied,
  clearGoogleAnalyticsCookies,
  initGoogleAnalytics,
  initGoogleTagManager,
  isGtmScriptPresent,
  setSafeGooglePageContext,
  updateAnalyticsConsentDenied,
  updateAnalyticsConsentGranted,
  resetGtmLoaderForTests,
} from './analytics/gtm'

export {
  trackPageView,
  trackSignUp,
  trackLogin,
  trackBeginCheckout,
  trackPurchaseUnsupportedReason,
} from './analytics/track'

export { canLoadAnalytics, isAnalyticsHostAllowed, getGtmContainerId } from './analytics/env'
