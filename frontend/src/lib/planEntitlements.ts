import type { PlanEntitlements } from './authApi'
import type { SubscriptionSnapshot } from './authApi'
import { voiceListenQuotaForSnapshot } from './voiceQuota'

/** Keep in sync with backend/plan_entitlements.py */
const CHAT_CONTEXT_BY_PLAN: Record<string, number> = {
  trial: 6,
  starter: 12,
  premium: 24,
  annual: 24,
  admin: 24,
}

const MEMORY_CONTEXT_BY_PLAN: Record<string, number> = {
  trial: 3,
  starter: 5,
  premium: 10,
  annual: 15,
  admin: 15,
}

/** 0 = unlimited archived threads */
const ARCHIVED_THREADS_BY_PLAN: Record<string, number> = {
  trial: 3,
  starter: 0,
  premium: 0,
  annual: 0,
  admin: 0,
}

function planSlot(
  entitlements: PlanEntitlements | null | undefined,
  snapshot: SubscriptionSnapshot | null,
): string {
  const slot = (entitlements?.plan_slot || snapshot?.plan || 'trial').toLowerCase()
  if (slot.includes('annual') || slot.includes('year') || slot.includes('ετήσ')) return 'annual'
  if (slot.includes('premium')) return 'premium'
  if (slot.includes('starter')) return 'starter'
  if (snapshot?.is_trial || slot === 'trial') return 'trial'
  return slot in CHAT_CONTEXT_BY_PLAN ? slot : 'trial'
}

export function chatContextDepth(
  entitlements: PlanEntitlements | null | undefined,
  snapshot: SubscriptionSnapshot | null,
): number {
  if (entitlements?.chat_context_messages != null) return entitlements.chat_context_messages
  return CHAT_CONTEXT_BY_PLAN[planSlot(entitlements, snapshot)] ?? 6
}

export function memoryContextCount(
  entitlements: PlanEntitlements | null | undefined,
  snapshot: SubscriptionSnapshot | null,
): number {
  if (entitlements?.memory_context_count != null) return entitlements.memory_context_count
  return MEMORY_CONTEXT_BY_PLAN[planSlot(entitlements, snapshot)] ?? 3
}

export function archivedThreadsLimit(
  entitlements: PlanEntitlements | null | undefined,
  snapshot: SubscriptionSnapshot | null,
): number {
  if (entitlements?.archived_threads_limit != null) return entitlements.archived_threads_limit
  return ARCHIVED_THREADS_BY_PLAN[planSlot(entitlements, snapshot)] ?? 3
}

export function fullMemoryAllowed(
  entitlements: PlanEntitlements | null | undefined,
  snapshot: SubscriptionSnapshot | null,
): boolean {
  if (entitlements?.full_memory != null) return entitlements.full_memory
  const slot = snapshot?.plan?.toLowerCase() || ''
  if (snapshot?.is_trial || slot === 'trial') return false
  return !!snapshot?.subscription_active
}

export function memoryVideoAllowed(
  entitlements: PlanEntitlements | null | undefined,
  snapshot: SubscriptionSnapshot | null,
): boolean {
  if (entitlements?.memory_video != null) return entitlements.memory_video
  return fullMemoryAllowed(entitlements, snapshot)
}

export function documentArchiveAllowed(
  entitlements: PlanEntitlements | null | undefined,
  snapshot: SubscriptionSnapshot | null,
): boolean {
  if (entitlements?.document_archive != null) return entitlements.document_archive
  return fullMemoryAllowed(entitlements, snapshot)
}

export function documentUploadAllowed(
  entitlements: PlanEntitlements | null | undefined,
  snapshot: SubscriptionSnapshot | null,
): boolean {
  if (entitlements?.document_upload != null) return entitlements.document_upload
  return documentArchiveAllowed(entitlements, snapshot)
}

export function voiceQuotaFallback(snapshot: SubscriptionSnapshot | null): {
  used: number
  limit: number
  remaining: number
} {
  const limit = voiceListenQuotaForSnapshot(snapshot)
  return { used: 0, limit, remaining: limit }
}
