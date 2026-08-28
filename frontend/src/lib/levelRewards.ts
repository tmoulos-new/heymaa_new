/** Keep in sync with backend/plan_grants.py LEVEL_REWARD_GRANTS */

export type LevelPlanReward = {
  levelId: number
  planSlot: 'starter' | 'premium'
  days: number
}

export const LEVEL_PLAN_REWARDS: LevelPlanReward[] = [
  { levelId: 2, planSlot: 'starter', days: 7 },
  { levelId: 3, planSlot: 'starter', days: 14 },
  { levelId: 4, planSlot: 'premium', days: 7 },
  { levelId: 5, planSlot: 'premium', days: 14 },
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

export function rewardDescription(reward: PendingLevelReward, lang: string): string {
  const plan = planLabel(reward.plan_slot, lang)
  if (lang === 'el') {
    return `${reward.days} μέρες δωρεάν ${plan}`
  }
  return `${reward.days} days free ${plan}`
}

export function rewardTitle(levelId: number, lang: string): string {
  const names: Record<number, { el: string; en: string }> = {
    2: { el: 'Ενεργή Μαμά', en: 'Active Mom' },
    3: { el: 'Αφοσιωμένη Μαμά', en: 'Dedicated Mom' },
    4: { el: 'Super Μαμά', en: 'Super Mom' },
    5: { el: 'HeyMaa Champion', en: 'HeyMaa Champion' },
  }
  const row = names[levelId]
  if (!row) return lang === 'el' ? 'Νέο επίπεδο!' : 'New level!'
  return lang === 'el' ? row.el : row.en
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
