import type { GamificationStatus } from "./userGamification";

function getApiBase(): string {
  const h = window.location.hostname
  const envUrl = (process.env.REACT_APP_API_URL || '').trim()
  const envIsLocal = /localhost|127\.0\.0\.1/i.test(envUrl)
  const pageIsLocal = h === 'localhost' || h === '127.0.0.1'
  if (envUrl && !(envIsLocal && !pageIsLocal)) return envUrl.replace(/\/$/, '')
  if (pageIsLocal) return 'http://127.0.0.1:8000'
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
  level_up?: { from: number; to: number };
  rewards?: import('./levelRewards').RewardsSnapshot;
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
