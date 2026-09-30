import axios from 'axios'
import { API } from './authApi'

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

export async function enablePush(token: string): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'denied'
  await subscribePush(token)
  return 'granted'
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
