import type { PlanEntitlements, SubscriptionSnapshot } from './authApi'
import {
  archivedThreadsLimit,
  documentArchiveAllowed,
  documentUploadAllowed,
} from './planEntitlements'
import { activePlanNameForSlot, resolveCurrentPlanSlot, type PlanSlot } from './subscriptionPlans'

/** Gateable product features — keep min plans in sync with marketing / backend. */
export type PlanFeatureId =
  | 'document_archive'
  | 'document_upload'
  | 'full_memory'
  | 'memory_video'
  | 'archived_threads'
  | 'voice_listen'

const FEATURE_MIN_PLAN: Record<PlanFeatureId, PlanSlot> = {
  document_archive: 'starter',
  document_upload: 'starter',
  full_memory: 'starter',
  memory_video: 'starter',
  archived_threads: 'starter',
  voice_listen: 'starter',
}

const PLAN_RANK: Record<PlanSlot, number> = {
  trial: 0,
  starter: 1,
  premium: 2,
  annual: 3,
}

const PLAN_ORDER: PlanSlot[] = ['trial', 'starter', 'premium', 'annual']

const FEATURE_LABELS: Record<PlanFeatureId, { el: string; en: string }> = {
  document_archive: { el: 'Αρχείο Εγγράφων', en: 'Document Archive' },
  document_upload: { el: 'Ανέβασμα αρχείου', en: 'File upload' },
  full_memory: { el: 'Πλήρης Μνήμη', en: 'Full Memory' },
  memory_video: { el: 'Βίντεο αναμνήσεων', en: 'Memory videos' },
  archived_threads: { el: 'Απεριόριστες αρχειοθετημένες συνομιλίες', en: 'Unlimited archived conversations' },
  voice_listen: { el: 'Φωνητικά μηνύματα', en: 'Voice messages' },
}

function planMeetsMinimum(current: PlanSlot | null, minimum: PlanSlot): boolean {
  if (!current) return false
  return PLAN_RANK[current] >= PLAN_RANK[minimum]
}

export function featureMinPlan(feature: PlanFeatureId): PlanSlot {
  return FEATURE_MIN_PLAN[feature]
}

export function featureLabel(feature: PlanFeatureId, lang: string): string {
  const copy = FEATURE_LABELS[feature]
  return lang === 'el' ? copy.el : copy.en
}

export function featureRequiredPlanLabel(feature: PlanFeatureId, lang: string): string {
  return activePlanNameForSlot(featureMinPlan(feature), [], lang)
}

export function nextUpgradePlanSlot(snapshot: SubscriptionSnapshot | null): PlanSlot | null {
  const current = resolveCurrentPlanSlot(snapshot)
  if (!current) return 'starter'
  const idx = PLAN_ORDER.indexOf(current)
  if (idx < 0 || idx >= PLAN_ORDER.length - 1) return null
  return PLAN_ORDER[idx + 1]
}

export function nextUpgradePlanLabel(snapshot: SubscriptionSnapshot | null, lang: string): string {
  const next = nextUpgradePlanSlot(snapshot)
  if (next) return activePlanNameForSlot(next, [], lang)
  return activePlanNameForSlot('premium', [], lang)
}

export function canArchiveAnotherThread(
  entitlements: PlanEntitlements | null | undefined,
  snapshot: SubscriptionSnapshot | null,
  archivedCount: number,
): boolean {
  const limit = archivedThreadsLimit(entitlements, snapshot)
  if (limit === 0) return true
  return archivedCount < limit
}

export function featureAllowed(
  feature: PlanFeatureId,
  entitlements: PlanEntitlements | null | undefined,
  snapshot: SubscriptionSnapshot | null,
): boolean {
  if (feature === 'full_memory') {
    if (entitlements?.full_memory != null) return entitlements.full_memory
  }
  if (feature === 'memory_video') {
    if (entitlements?.memory_video != null) return entitlements.memory_video
  }
  if (feature === 'document_archive') {
    return documentArchiveAllowed(entitlements, snapshot)
  }
  if (feature === 'document_upload') {
    return documentUploadAllowed(entitlements, snapshot)
  }
  return planMeetsMinimum(resolveCurrentPlanSlot(snapshot), FEATURE_MIN_PLAN[feature])
}
