const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LONG_HEX_RE = /^[0-9a-f]{16,}$/i
const NUMERIC_ID_RE = /^\d{6,}$/

/** Static titles only — never derive from chat, profile, or query content. */
const PATH_TITLES: Record<string, string> = {
  '/': 'HeyMaa — Home',
  '/home': 'HeyMaa — Home',
  '/app': 'HeyMaa — App',
  '/app/auth': 'HeyMaa — Sign in',
  '/auth': 'HeyMaa — Sign in',
  '/subscription': 'HeyMaa — Subscription',
  '/checkout': 'HeyMaa — Checkout',
  '/checkout/success': 'HeyMaa — Checkout success',
  '/checkout/failure': 'HeyMaa — Checkout failure',
  '/checkout/failed': 'HeyMaa — Checkout failure',
  '/terms': 'HeyMaa — Terms',
  '/privacy': 'HeyMaa — Privacy',
}

function normalizeSegment(segment: string): string {
  const s = decodeURIComponent(segment || '').trim()
  if (!s) return s
  if (UUID_RE.test(s) || LONG_HEX_RE.test(s) || NUMERIC_ID_RE.test(s)) return ':id'
  if (/^(thread|chat|user|child|mem|doc)/i.test(s) && s.length > 12) return ':id'
  return s
}

/** Strip query + hash; collapse sensitive/dynamic path segments to templates. */
export function sanitizePathname(pathname: string): string {
  let path = (pathname || '/').split('?')[0].split('#')[0] || '/'
  if (!path.startsWith('/')) path = `/${path}`
  path = path.replace(/\/{2,}/g, '/')
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)

  const parts = path.split('/').map((p, i) => (i === 0 ? '' : normalizeSegment(p)))
  let out = parts.join('/') || '/'
  if (!out.startsWith('/')) out = `/${out}`

  // Known aliases
  if (out === '/checkout/failed') return '/checkout/failure'
  return out
}

export function pageTitleForPath(pathname: string): string {
  const path = sanitizePathname(pathname)
  return PATH_TITLES[path] || 'HeyMaa'
}

/**
 * Absolute URL with query/hash removed and path templated.
 * Host is taken from the URL when present, else current origin.
 */
export function sanitizeAbsoluteUrl(raw: string, fallbackOrigin?: string): string {
  const origin =
    fallbackOrigin ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://www.heymaa.ai')
  try {
    const base = raw && /^https?:\/\//i.test(raw) ? raw : `${origin}${raw || '/'}`
    const u = new URL(base)
    const path = sanitizePathname(u.pathname)
    return `${u.origin}${path}`
  } catch {
    return `${origin}${sanitizePathname(raw || '/')}`
  }
}

/** External referrer: keep origin + safe path only (no query/hash). */
export function sanitizeReferrer(raw: string | null | undefined): string {
  const text = (raw || '').trim()
  if (!text) return ''
  try {
    const u = new URL(text)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    return `${u.origin}${sanitizePathname(u.pathname)}`
  } catch {
    return ''
  }
}

export function shouldSkipPageViewPath(pathname: string, search: string, hasToken: boolean): boolean {
  const path = sanitizePathname(pathname)
  const params = new URLSearchParams(search || '')
  // Auth token present on `/` → PublicHome redirects to /app
  if (path === '/' && hasToken) return true
  // Password-reset deep link redirects into /app
  if (path === '/' && params.get('reset')) return true
  // Legacy /auth → /app/auth
  if (path === '/auth') return true
  return false
}
