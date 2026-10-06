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
  trackPurchase,
} from './analytics/track'

export { canLoadAnalytics, isAnalyticsHostAllowed, getGtmContainerId } from './analytics/env'
