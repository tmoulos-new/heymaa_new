import axios from 'axios'

export const HM_TOKEN_KEY = 'hm_token'

export function getApiBase(): string {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1') return 'http://127.0.0.1:8000'
  if (h.endsWith('.vercel.app')) return window.location.origin
  return window.location.origin
}

export const API = getApiBase()

export function apiDetail(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback
  const d = (data as { detail?: unknown }).detail
  if (typeof d === 'string') return d
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
