import { API } from './authApi'

export type GiftPreview = {
  code?: string
  gift_type?: string
  plan_slot?: string | null
  days?: number | null
  points?: number | null
  label?: string | null
  claimable?: boolean
  reason?: string
}

export type GiftClaimResult = {
  ok?: boolean
  gift_type?: string
  code?: string
  grant?: {
    id?: string
    plan_slot?: string
    days?: number
    starts_at?: string
    ends_at?: string
    upgraded?: boolean
  }
  points?: number
  points_balance?: number
  status?: unknown
  detail?: string
}

const PENDING_KEY = 'hm_pending_gift_code'

export function stashPendingGiftCode(code: string) {
  const clean = (code || '').trim().toUpperCase()
  if (!clean) return
  try {
    sessionStorage.setItem(PENDING_KEY, clean)
  } catch {
    /* ignore */
  }
}

export function readPendingGiftCode(): string {
  try {
    return (sessionStorage.getItem(PENDING_KEY) || '').trim().toUpperCase()
  } catch {
    return ''
  }
}

export function clearPendingGiftCode() {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignore */
  }
}

export function giftCodeFromLocation(search = typeof window !== 'undefined' ? window.location.search : ''): string {
  try {
    const params = new URLSearchParams(search)
    return (params.get('gift') || '').trim().toUpperCase()
  } catch {
    return ''
  }
}

export async function previewGift(code: string): Promise<GiftPreview> {
  const res = await fetch(`${API}/gifts/preview?code=${encodeURIComponent(code.trim())}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(String(data.detail || data.error || 'Gift not found'))
  }
  return (data.gift || {}) as GiftPreview
}

export async function claimGift(token: string, code: string): Promise<GiftClaimResult> {
  const res = await fetch(`${API}/gifts/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-token': token,
    },
    body: JSON.stringify({ code: code.trim() }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(String(data.detail || data.error || 'Could not claim gift'))
  }
  return data as GiftClaimResult
}
