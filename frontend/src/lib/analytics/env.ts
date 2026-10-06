/** Production origin that may load GTM. Apex heymaa.ai is excluded (redirect-only). */
export const ANALYTICS_PRODUCTION_HOST = 'www.heymaa.ai'

export function getGtmContainerId(): string {
  return (process.env.REACT_APP_GTM_ID || '').trim()
}

export function currentHostname(): string {
  if (typeof window === 'undefined') return ''
  return (window.location.hostname || '').trim().toLowerCase()
}

/**
 * GTM/GA load only on the exact production hostname with a configured container id.
 * Blocks localhost, previews, and staging even when NODE_ENV is production.
 */
export function isAnalyticsHostAllowed(hostname: string = currentHostname()): boolean {
  const host = (hostname || '').trim().toLowerCase()
  if (!host) return false
  if (host === 'localhost' || host === '127.0.0.1') return false
  if (host.endsWith('.localhost')) return false
  if (host.includes('vercel.app') || host.includes('netlify.app')) return false
  if (host.includes('staging') || host.includes('preview') || host.includes('dev.')) return false
  return host === ANALYTICS_PRODUCTION_HOST
}

export function canLoadAnalytics(): boolean {
  return Boolean(getGtmContainerId()) && isAnalyticsHostAllowed()
}
