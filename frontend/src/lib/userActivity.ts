function getApiBase(): string {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1') return 'http://127.0.0.1:8000'
  if (h.endsWith('.vercel.app')) return window.location.origin
  return window.location.origin
}

export type UserActivityAction =
  | 'view'
  | 'click'
  | 'navigate'
  | 'submit'
  | 'open'
  | 'close'
  | 'change'

export function appPath(...segments: string[]): string {
  const tail = segments.filter(Boolean).join('/').replace(/^\/+/, '')
  return tail ? `/app/${tail}` : '/app'
}

export function logUserActivity(
  token: string,
  payload: {
    action: UserActivityAction | string
    path: string
    label?: string
    details?: Record<string, unknown>
  },
): void {
  if (!token || !payload.path) return
  const API = getApiBase()
  void fetch(`${API}/user_activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-token': token },
    body: JSON.stringify(payload),
  }).catch(() => {})
}
