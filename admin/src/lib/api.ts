export function getApiBase(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const h = window.location.hostname
    if (h === 'localhost' || h === '127.0.0.1') {
      return import.meta.env.VITE_API_PROXY || 'http://127.0.0.1:8000'
    }
  }
  // Production: same-origin (Vercel rewrites /admin/* and /auth/* to API).
  return ''
}

function detailObject(detail: unknown): Record<string, unknown> | null {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  return detail as Record<string, unknown>
}

export function apiDetail(d: unknown): string {
  if (!d || typeof d !== 'object') return ''
  const o = d as Record<string, unknown>
  if (typeof o.friendly_message === 'string') return o.friendly_message
  if (typeof o.detail === 'string') return o.detail
  const nested = detailObject(o.detail)
  if (nested) {
    if (typeof nested.friendly_message === 'string') return nested.friendly_message
    if (typeof nested.detail === 'string') return nested.detail
  }
  if (Array.isArray(o.detail)) {
    return o.detail.map((x) => {
      if (x && typeof x === 'object' && 'msg' in x) return String((x as { msg: string }).msg)
      return JSON.stringify(x)
    }).join('; ')
  }
  return String(o.error || o.message || '')
}
