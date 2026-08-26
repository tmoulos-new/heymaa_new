import type { PlanEntitlements } from './authApi'
import type { SubscriptionSnapshot } from './authApi'
import { voiceListenQuotaForSnapshot } from './voiceQuota'

export function memoryVideoAllowed(
  entitlements: PlanEntitlements | null | undefined,
  snapshot: SubscriptionSnapshot | null,
): boolean {
  if (entitlements?.memory_video != null) return entitlements.memory_video
  // Fallback until /auth/status loads entitlements
  const slot = snapshot?.plan?.toLowerCase() || ''
  if (snapshot?.is_trial || slot === 'trial') return false
  return !!snapshot?.subscription_active
}

export function voiceQuotaFallback(snapshot: SubscriptionSnapshot | null): {
  used: number
  limit: number
  remaining: number
} {
  const limit = voiceListenQuotaForSnapshot(snapshot)
  return { used: 0, limit, remaining: limit }
}
