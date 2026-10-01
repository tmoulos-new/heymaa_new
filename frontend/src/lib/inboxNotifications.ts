import axios from 'axios'
import { API } from './authApi'
import { isIosDevice, isStandaloneDisplay } from './pushAlerts'

export type InboxNotification = {
  id: string
  title: string
  body: string
  url?: string | null
  created_at?: string
  read: boolean
}

function headers(token: string) {
  return { 'x-token': token }
}

export async function fetchInbox(token: string): Promise<{ notifications: InboxNotification[]; unread: number }> {
  const res = await axios.get(`${API}/me/notifications`, { headers: headers(token) })
  return {
    notifications: (res.data?.notifications || []) as InboxNotification[],
    unread: Number(res.data?.unread || 0),
  }
}

export async function markInboxRead(token: string, ids: string[]) {
  if (!ids.length) return
  await axios.post(`${API}/me/notifications/read`, { ids }, { headers: headers(token) })
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission
}

export async function setPushOptInPreference(token: string, optedIn: boolean): Promise<void> {
  await axios.post(
    `${API}/me/push/preference`,
    { opted_in: optedIn },
    { headers: headers(token) },
  )
}

/** Request browser permission (must run from a user gesture), then subscribe. */
export async function enablePush(token: string): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported'
  if (isIosDevice() && !isStandaloneDisplay()) {
    // iOS Safari only delivers Web Push from Home Screen apps.
    // Still allow the preference save; UI should explain install.
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    try {
      await setPushOptInPreference(token, false)
    } catch {
      /* preference sync best-effort */
    }
    return 'denied'
  }
  await subscribePush(token)
  try {
    await setPushOptInPreference(token, true)
  } catch {
    /* subscription already implies opt-in on the server */
  }
  return 'granted'
}

export async function disablePush(token: string): Promise<void> {
  if (pushSupported()) {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
    } catch {
      /* continue clearing server rows */
    }
  }
  await axios.delete(`${API}/me/push/subscribe`, { headers: headers(token) })
  try {
    await setPushOptInPreference(token, false)
  } catch {
    /* best-effort */
  }
}

export async function subscribePush(token: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return
  const keyRes = await axios.get(`${API}/me/push/public-key`, { headers: headers(token) })
  const publicKey = String(keyRes.data?.public_key || '')
  if (!publicKey) throw new Error('Push is not configured')
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }
  const json = sub.toJSON()
  await axios.post(
    `${API}/me/push/subscribe`,
    { endpoint: json.endpoint, keys: json.keys },
    { headers: headers(token) },
  )
}
