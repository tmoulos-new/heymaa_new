import axios from 'axios'
import { normalizeAppLang } from './appLang'
import { stableSk } from './userDataRecovery'
import {
  HM_TOKEN_KEY,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  persistAuthSession,
  clearAuthToken,
  hasAuthToken,
} from './authStorage'

axios.defaults.withCredentials = true

export {
  HM_TOKEN_KEY,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  persistAuthSession,
  clearAuthToken,
  hasAuthToken,
}
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
  const envUrl = (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_PROXY || '').trim()
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
  document_archive?: boolean
  document_upload?: boolean
  export_enabled?: boolean
  chat_context_messages?: number
  memory_context_count?: number
  milestone_context_count?: number
  archived_threads_limit?: number
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
  subscription_ends_at?: string | null
  is_trial: boolean
  plan?: string | null
  entitlements?: PlanEntitlements
  voice_quota?: VoiceQuota
  cancel_requested?: boolean
  cancel_status?: 'pending' | 'approved' | 'dismissed' | string | null
  cancel_access_until?: string | null
  access_ends_at?: string | null
  rewards?: import('./levelRewards').RewardsSnapshot
  active_plan_grants?: import('./levelRewards').ActivePlanGrant[]
  ok?: boolean
}

type AuthMeSnapshot = {
  name?: string
  email?: string
  must_change_password?: boolean
  gamification?: unknown
  referral_code?: string
  rewards?: import('./levelRewards').RewardsSnapshot
  [key: string]: unknown
}

const AUTH_BOOTSTRAP_TTL_MS = 8000
const SUB_ACTIVE_CACHE_PREFIX = 'hm_sub_active_'

const inflightMe = new Map<string, Promise<AuthMeSnapshot>>()
const inflightStatus = new Map<string, Promise<SubscriptionSnapshot>>()
const cachedMe = new Map<string, { at: number; data: AuthMeSnapshot }>()
const cachedStatus = new Map<string, { at: number; data: SubscriptionSnapshot }>()

function coalesceAuthFetch<T>(
  inflight: Map<string, Promise<T>>,
  cache: Map<string, { at: number; data: T }>,
  token: string,
  run: () => Promise<T>,
  force?: boolean,
): Promise<T> {
  if (!force) {
    const hit = cache.get(token)
    if (hit && Date.now() - hit.at < AUTH_BOOTSTRAP_TTL_MS) return Promise.resolve(hit.data)
    const pending = inflight.get(token)
    if (pending) return pending
  }
  const p = run()
    .then((data) => {
      cache.set(token, { at: Date.now(), data })
      return data
    })
    .finally(() => {
      inflight.delete(token)
    })
  inflight.set(token, p)
  return p
}

export function invalidateAuthCaches(token?: string | null) {
  if (token) {
    inflightMe.delete(token)
    inflightStatus.delete(token)
    cachedMe.delete(token)
    cachedStatus.delete(token)
    return
  }
  inflightMe.clear()
  inflightStatus.clear()
  cachedMe.clear()
  cachedStatus.clear()
}

function subActiveCacheKey(token: string): string {
  return `${SUB_ACTIVE_CACHE_PREFIX}${token.slice(-16)}`
}

export function readCachedSubscriptionActive(token: string): boolean | null {
  if (!token) return null
  try {
    const v = sessionStorage.getItem(subActiveCacheKey(token))
    if (v === '1') return true
    if (v === '0') return false
  } catch {
    /* ignore */
  }
  return null
}

export function writeCachedSubscriptionActive(token: string, active: boolean): void {
  if (!token) return
  try {
    sessionStorage.setItem(subActiveCacheKey(token), active ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export async function fetchAuthMe(token: string, opts?: { force?: boolean }) {
  return coalesceAuthFetch(inflightMe, cachedMe, token, async () => {
    const res = await axios.get<AuthMeSnapshot>(`${API}/auth/me`, {
      headers: { 'x-token': token },
    })
    return res.data
  }, opts?.force)
}

export async function fetchSubscriptionStatus(token: string, opts?: { force?: boolean }) {
  return coalesceAuthFetch(inflightStatus, cachedStatus, token, async () => {
    const res = await axios.get<SubscriptionSnapshot>(`${API}/auth/status`, {
      headers: { 'x-token': token },
    })
    writeCachedSubscriptionActive(token, res.data.subscription_active !== false)
    return res.data
  }, opts?.force)
}

export async function logoutUser(token?: string | null) {
  const headers = token ? { 'x-token': token } : undefined
  return axios.post(`${API}/auth/logout`, {}, { headers })
}

type AuthSessionPayload = { token?: string; refresh_token?: string }

/** Prevents cookie/refresh restores from writing tokens back during/after logout. */
let sessionPersistBlocked = false
const LOGOUT_FLAG = 'hm_explicit_logout'

export function allowAuthSessionPersist(): void {
  sessionPersistBlocked = false
  try {
    sessionStorage.removeItem(LOGOUT_FLAG)
  } catch {
    /* ignore */
  }
}

export function blockAuthSessionPersist(): void {
  sessionPersistBlocked = true
  refreshInflight = null
  try {
    sessionStorage.setItem(LOGOUT_FLAG, '1')
  } catch {
    /* ignore */
  }
}

function applySessionPayload(data: AuthSessionPayload | undefined): string | null {
  if (sessionPersistBlocked) return null
  try {
    if (sessionStorage.getItem(LOGOUT_FLAG) === '1') return null
  } catch {
    /* ignore */
  }
  const token = typeof data?.token === 'string' ? data.token : ''
  if (!token) return null
  persistAuthSession(token, data?.refresh_token)
  return token
}

let refreshInflight: Promise<string | null> | null = null

/** Exchange the saved refresh token / cookie for a new access token. */
export function refreshAuthSession(): Promise<string | null> {
  if (sessionPersistBlocked) return Promise.resolve(null)
  if (refreshInflight) return refreshInflight
  refreshInflight = (async () => {
    try {
      if (sessionPersistBlocked) return null
      const refresh = getRefreshToken()
      const res = await axios.post<AuthSessionPayload>(
        `${API}/auth/refresh`,
        refresh ? { refresh_token: refresh } : {},
      )
      return applySessionPayload(res.data)
    } catch {
      return null
    } finally {
      refreshInflight = null
    }
  })()
  return refreshInflight
}

/** Reopen a saved login from localStorage or the HttpOnly session cookie. */
export async function restoreAuthSession(): Promise<string | null> {
  try {
    if (sessionStorage.getItem(LOGOUT_FLAG) === '1' || sessionPersistBlocked) {
      return null
    }
  } catch {
    /* ignore */
  }
  const existing = getAuthToken()
  if (existing) return existing
  try {
    const res = await axios.get<AuthSessionPayload>(`${API}/auth/session`)
    return applySessionPayload(res.data)
  } catch {
    return refreshAuthSession()
  }
}

export async function requestSubscriptionCancel(token: string) {
  const res = await axios.post<{
    ok: boolean
    cancel_requested?: boolean
    cancel_status?: string
    cancel_access_until?: string | null
    message?: string
  }>(`${API}/auth/cancel-subscription`, {}, { headers: { 'x-token': token } })
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
