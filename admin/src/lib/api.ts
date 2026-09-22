export function getApiBase(): string {
  // Optional absolute override (e.g. point a local UI at a remote API).
  // Do not use VITE_API_PROXY here — that var is only the Vite/CRA proxy *target*.
  // Locally, keep same-origin so /admin/* and /auth/* go through the dev proxy
  // (defaulting the client to :8000 broke admin when the API runs on :8010).
  if (import.meta.env.VITE_API_URL) return String(import.meta.env.VITE_API_URL)
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
