export function getApiBase(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (import.meta.env.DEV) return 'http://127.0.0.1:8000'
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1') {
    return `${window.location.protocol}//${window.location.host}`
  }
  return 'https://api.vdarpp.com'
}

export function apiDetail(d: unknown): string {
  if (!d || typeof d !== 'object') return ''
  const o = d as Record<string, unknown>
  if (typeof o.detail === 'string') return o.detail
  if (Array.isArray(o.detail)) {
    return o.detail.map((x) => {
      if (x && typeof x === 'object' && 'msg' in x) return String((x as { msg: string }).msg)
      return JSON.stringify(x)
    }).join('; ')
  }
  return String(o.error || o.message || '')
}
