import type { GamificationStatus } from "./userGamification";

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

export type UserActivityResult = {
  ok: boolean;
  points_awarded?: number;
  gamification?: GamificationStatus;
};

export function appPath(...segments: string[]): string {
  const tail = segments.filter(Boolean).join('/').replace(/^\/+/, '')
  return tail ? `/app/${tail}` : '/app'
}

export async function logUserActivity(
  token: string,
  payload: {
    action: UserActivityAction | string
    path: string
    label?: string
    details?: Record<string, unknown>
  },
): Promise<UserActivityResult | null> {
  if (!token || !payload.path) return null
  const API = getApiBase()
  try {
    const res = await fetch(`${API}/user_activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-token': token },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return null
    return (await res.json()) as UserActivityResult
  } catch {
    return null
  }
}
