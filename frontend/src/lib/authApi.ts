import axios from 'axios'

export const HM_TOKEN_KEY = 'hm_token'
/** Local-only session when Supabase/DB is unavailable — never used in production auth. */
export const LOCAL_DEMO_TOKEN = 'hm_local_demo'

export function isBrowserLocalHost(): boolean {
  return isLocalHost(window.location.hostname)
}

export function isLocalDemoToken(token: string | null | undefined): boolean {
  return !!token && token === LOCAL_DEMO_TOKEN
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function isLocalApiUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return isLocalHost(u.hostname)
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url)
  }
}

export function getApiBase(): string {
  const h = window.location.hostname
  const envUrl = (process.env.REACT_APP_API_URL || '').trim()
  // Never bake a localhost API into production (www.heymaa.ai / Vercel).
  if (envUrl && !(isLocalApiUrl(envUrl) && !isLocalHost(h))) {
    return envUrl.replace(/\/$/, '')
  }
  if (isLocalHost(h)) return 'http://127.0.0.1:8000'
  return window.location.origin
}

export const API = getApiBase()

export function apiDetail(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback
  const d = (data as { detail?: unknown }).detail
  if (typeof d === 'string') return d
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    const obj = d as { friendly_message?: unknown; detail?: unknown; message?: unknown }
    if (typeof obj.friendly_message === 'string' && obj.friendly_message.trim()) return obj.friendly_message
    if (typeof obj.detail === 'string' && obj.detail.trim()) return obj.detail
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message
  }
  if (Array.isArray(d)) {
    return (
      d
        .map((x) =>
          x && typeof x === 'object' && 'msg' in x
            ? String((x as { msg: string }).msg)
            : JSON.stringify(x),
        )
        .join('; ') || fallback
    )
  }
  return fallback
}

export type RegisterPayload = {
  email: string
  password: string
  name: string
  invite_code?: string
  want_child?: boolean
  pregnancy_or_mom?: boolean
  consent_marketing?: boolean
  consent_privacy: boolean
  consent_terms: boolean
  lang?: string
}

export async function registerUser(payload: RegisterPayload) {
  return axios.post(`${API}/auth/register`, payload)
}

export async function loginUser(email: string, password: string) {
  return axios.post(`${API}/auth/login`, { email, password })
}

export async function checkEmail(email: string) {
  return axios.post(`${API}/auth/check_email`, { email })
}

export type SubscriptionSnapshot = {
  subscription_active: boolean
  subscription_status: string | null
  trial_ends_at: string | null
  is_trial: boolean
  plan?: string | null
}

export async function fetchSubscriptionStatus(token: string) {
  const res = await axios.get<SubscriptionSnapshot>(`${API}/auth/status`, {
    headers: { 'x-token': token },
  })
  return res.data
}

export type VivaCheckoutResponse = {
  orderCode: string
  checkoutUrl: string
  plan: string
  amount: number
  label: string
}

export async function createVivaCheckout(plan: string, lang: string, token: string | null) {
  const headers: Record<string, string> = {}
  if (token) headers['x-token'] = token
  const res = await axios.post<VivaCheckoutResponse>(
    `${API}/checkout/viva`,
    { plan, lang },
    { headers },
  )
  return res.data
}
