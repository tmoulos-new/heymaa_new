/** Keep in sync with backend/plan_grants.py LEVEL_REWARD_GRANTS */

import { GAMIFICATION_LEVELS } from './gamificationCard'

export type LevelPlanReward = {
  levelId: number
  planSlot: 'starter' | 'premium'
  days: number
}

export const LEVEL_PLAN_REWARDS: LevelPlanReward[] = [
  { levelId: 2, planSlot: 'starter', days: 3 },
  { levelId: 3, planSlot: 'starter', days: 7 },
  { levelId: 4, planSlot: 'premium', days: 3 },
  { levelId: 5, planSlot: 'premium', days: 7 },
]

export type PendingLevelReward = {
  level_id: number
  plan_slot: 'starter' | 'premium'
  days: number
}

export type ActivePlanGrant = {
  id?: string
  plan_slot: string
  starts_at?: string
  ends_at: string
  source?: string
  level_id?: number
}

export type RewardsSnapshot = {
  pending: PendingLevelReward[]
  claimed_level_ids: number[]
  active_grants: ActivePlanGrant[]
}

export function planLabel(slot: string, lang: string): string {
  const p = slot.toLowerCase()
  if (p === 'premium') return lang === 'el' ? 'Premium' : 'Premium'
  if (p === 'starter') return 'Starter'
  return slot
}

/** Keep in sync with backend/plan_grants.py PLAN_SLOT_RANK */

const PLAN_SLOT_RANK: Record<string, number> = {
  trial: 0,
  starter: 1,
  premium: 2,
  annual: 3,
  admin: 4,
}

export function planSlotRank(slot: string | null | undefined): number {
  return PLAN_SLOT_RANK[(slot || 'trial').toLowerCase()] ?? 0
}

export function effectiveRewardPlanSlot(
  reward: PendingLevelReward,
  currentPlanSlot?: string | null,
): string {
  const currentRank = planSlotRank(currentPlanSlot)
  const rewardRank = planSlotRank(reward.plan_slot)
  if (currentRank > rewardRank) {
    return (currentPlanSlot || reward.plan_slot).toLowerCase()
  }
  return reward.plan_slot
}

export function isRewardUpgradedForPlan(
  reward: PendingLevelReward,
  currentPlanSlot?: string | null,
): boolean {
  return planSlotRank(currentPlanSlot) > planSlotRank(reward.plan_slot)
}

export function effectiveRewardDescription(
  reward: PendingLevelReward,
  lang: string,
  currentPlanSlot?: string | null,
): string {
  const slot = effectiveRewardPlanSlot(reward, currentPlanSlot)
  const plan = planLabel(slot, lang)
  if (lang === 'el') {
    return `${reward.days} μέρες δωρεάν ${plan}`
  }
  return `${reward.days} days free ${plan}`
}

export function rewardClaimBody(
  reward: PendingLevelReward,
  lang: string,
  currentPlanSlot?: string | null,
): string {
  const desc = effectiveRewardDescription(reward, lang, currentPlanSlot)
  const upgraded = isRewardUpgradedForPlan(reward, currentPlanSlot)
  const stacksLater = planSlotRank(currentPlanSlot) >= planSlotRank(reward.plan_slot)
    && planSlotRank(currentPlanSlot) > planSlotRank('trial')

  if (upgraded) {
    return lang === 'el'
      ? `Κέρδισες ${desc} — ισοδύναμο με το τρέχον πλάνο σου (όχι υποβάθμιση σε Starter). Οι ${reward.days} μέρες προστίθενται μετά τη λήξη της τρέχουσας πρόσβασής σου.`
      : `You earned ${desc} — matched to your current plan (not downgraded to Starter). The ${reward.days} days are added after your current access ends.`
  }
  if (stacksLater) {
    return lang === 'el'
      ? `Κέρδισες ${desc}. Οι μέρες προστίθενται μετά τη λήξη της τρέχουσας πρόσβασής σου — δεν χάνεις τίποτα.`
      : `You earned ${desc}. Days are added after your current access ends — nothing is lost.`
  }
  return lang === 'el'
    ? `Κέρδισες ${desc}. Διεκδίκησέ το τώρα — ενεργοποιείται αμέσως.`
    : `You earned ${desc}. Claim now — it activates immediately.`
}

export function rewardDescription(reward: PendingLevelReward, lang: string): string {
  const plan = planLabel(reward.plan_slot, lang)
  if (lang === 'el') {
    return `${reward.days} μέρες δωρεάν ${plan}`
  }
  return `${reward.days} days free ${plan}`
}

export function rewardTitle(levelId: number, lang: string): string {
  const level = GAMIFICATION_LEVELS.find((row) => row.number === levelId)
  if (!level) return lang === 'el' ? 'Νέο επίπεδο!' : 'New level!'
  return lang === 'el' ? level.name_el : level.name_en
}

const REWARD_DISMISS_PREFIX = 'hm_reward_dismiss_'

export function readDismissedRewardLevels(token: string): Set<number> {
  try {
    const raw = sessionStorage.getItem(`${REWARD_DISMISS_PREFIX}${token.slice(-12)}`)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.map(Number).filter((n) => n > 1) : [])
  } catch {
    return new Set()
  }
}

export function dismissRewardLevel(token: string, levelId: number): void {
  try {
    const key = `${REWARD_DISMISS_PREFIX}${token.slice(-12)}`
    const set = readDismissedRewardLevels(token)
    set.add(levelId)
    sessionStorage.setItem(key, JSON.stringify(Array.from(set)))
  } catch {
    /* ignore */
  }
}

export function firstUnseenPendingReward(
  token: string,
  rewards: RewardsSnapshot | null | undefined,
) {
  if (!rewards?.pending?.length) return null
  const dismissed = readDismissedRewardLevels(token)
  return rewards.pending.find((p) => !dismissed.has(p.level_id)) ?? null
}

/** Pick which pending reward to show — prefer a specific level (e.g. fresh level-up). */
export function selectPendingReward(
  rewards: RewardsSnapshot | null | undefined,
  options?: { token?: string; levelId?: number; force?: boolean },
): PendingLevelReward | null {
  if (!rewards?.pending?.length) return null
  if (options?.levelId != null) {
    const match = rewards.pending.find((p) => p.level_id === options.levelId)
    if (match) return match
  }
  if (options?.force) {
    return rewards.pending[0] ?? null
  }
  if (options?.token) {
    return firstUnseenPendingReward(options.token, rewards)
  }
  return rewards.pending[0] ?? null
}
