import axios from 'axios'
import { normalizeAppLang } from './appLang'
import { stableSk } from './userDataRecovery'

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

/** Checkout API — local FastAPI often lacks Viva credentials; production has them. */
export function getCheckoutApiBase(): string {
  const explicit = (process.env.REACT_APP_CHECKOUT_API_URL || '').trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const base = getApiBase()
  if (isBrowserLocalHost() && isLocalApiUrl(base)) {
    return 'https://www.heymaa.ai'
  }
  return base
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

/** Persist the account display name from signup/login into the local profile. */
export function applyAuthUserName(token: string, name: string | null | undefined) {
  const trimmed = String(name || '').trim()
  if (!token || !trimmed) return
  try {
    sessionStorage.setItem('hm_signup_name', trimmed)
  } catch {
    /* ignore */
  }
  try {
    const key = stableSk(token, 'profile')
    const raw = localStorage.getItem(key)
    const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
    const lang = normalizeAppLang(
      String(existing?.lang || localStorage.getItem('hm_pre_lang') || 'el'),
      'el',
    )
    const next = {
      childName: '',
      childAge: '',
      ...(existing && typeof existing === 'object' ? existing : {}),
      name: trimmed,
      lang,
    }
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export async function checkEmail(email: string) {
  return axios.post(`${API}/auth/check_email`, { email })
}

export type PlanEntitlements = {
  plan_slot: string
  voice_listen_quota: number
  full_memory: boolean
  memory_video: boolean
  memory_photos: boolean
  memory_text: boolean
}

export type VoiceQuota = {
  period: string
  used: number
  limit: number
  remaining: number
}

export type SubscriptionSnapshot = {
  subscription_active: boolean
  subscription_status: string | null
  trial_ends_at: string | null
  is_trial: boolean
  plan?: string | null
  entitlements?: PlanEntitlements
  voice_quota?: VoiceQuota
  ok?: boolean
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
    `${getCheckoutApiBase()}/checkout/viva`,
    { plan, lang },
    { headers },
  )
  return res.data
}
