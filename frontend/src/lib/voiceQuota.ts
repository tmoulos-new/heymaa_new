import type { SubscriptionSnapshot } from './authApi'
import type { PlanSlot } from './subscriptionPlans'
import { resolveCurrentPlanSlot } from './subscriptionPlans'

/** Monthly TTS «Listen» quota — keep in sync with pricing in home.json (el/en) */
export const VOICE_LISTEN_QUOTA_BY_PLAN: Record<PlanSlot, number> = {
  trial: 50,
  starter: 150,
  premium: 400,
  annual: 700,
}

export function voiceListenQuotaForPlan(slot: PlanSlot | null): number {
  if (!slot) return VOICE_LISTEN_QUOTA_BY_PLAN.trial
  return VOICE_LISTEN_QUOTA_BY_PLAN[slot] ?? VOICE_LISTEN_QUOTA_BY_PLAN.trial
}

export function voiceListenQuotaForSnapshot(
  snapshot: SubscriptionSnapshot | null,
): number {
  return voiceListenQuotaForPlan(resolveCurrentPlanSlot(snapshot))
}
