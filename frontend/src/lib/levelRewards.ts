/** Defaults — live values from GET /gamification/rules (admin Levels gifts). */

import { GAMIFICATION_LEVELS, getLevelPlanRewards } from './gamificationCard'

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

export function liveLevelPlanRewards(): LevelPlanReward[] {
  const live = getLevelPlanRewards()
  if (!live.length) return LEVEL_PLAN_REWARDS.map((r) => ({ ...r }))
  return live.map((r) => ({
    levelId: r.level_id,
    planSlot: r.plan_slot,
    days: r.days,
  }))
}

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
  const p = (slot || '').toLowerCase().trim()
  if (p === 'premium') return 'Premium'
  if (p === 'starter') return 'Starter'
  if (p === 'annual') return lang === 'el' ? 'Ετήσιο' : 'Annual'
  if (p === 'admin') return 'Admin'
  if (p === 'trial' || p === 'free') return lang === 'el' ? 'Δοκιμή' : 'Trial'
  if (!p) return lang === 'el' ? 'πλάνο' : 'plan'
  return p.charAt(0).toUpperCase() + p.slice(1)
}

/** Active temporary plan gift (level reward) — not staff admin role. */
export function activeGrantMessage(
  planSlot: string,
  endsAt: string,
  lang: string,
): string {
  const plan = planLabel(planSlot, lang)
  const date = new Date(endsAt).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB')
  if (lang === 'el') {
    return `Ενεργό δώρο επιπέδου: δωρεάν πλάνο ${plan} μέχρι ${date}.`
  }
  return `Active level gift: free ${plan} plan until ${date}.`
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
    return `${reward.days} μέρες δωρεάν πλάνο ${plan}`
  }
  return `${reward.days} days free ${plan} plan`
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
    return `${reward.days} μέρες δωρεάν πλάνο ${plan}`
  }
  return `${reward.days} days free ${plan} plan`
}

export function rewardTitle(levelId: number, lang: string): string {
  const level = GAMIFICATION_LEVELS.find((row) => row.number === levelId)
  if (!level) return lang === 'el' ? 'Νέο επίπεδο!' : 'New level!'
  return lang === 'el' ? level.name_el : level.name_en
}

export function levelUpKicker(lang: string): string {
  return lang === 'el' ? 'Ανέβηκες επίπεδο' : 'You leveled up'
}

export function claimSuccessMessage(
  grant: { upgraded?: boolean; plan_slot?: string; days?: number } | undefined,
  lang: string,
): string {
  const days = Number(grant?.days) || 0
  const plan = planLabel(grant?.plan_slot || 'starter', lang)
  if (!days) {
    return lang === 'el' ? 'Το δώρο ενεργοποιήθηκε! 🎁' : 'Your gift is active! 🎁'
  }
  if (grant?.upgraded) {
    return lang === 'el'
      ? `+${days} μέρες ${plan} μετά τη λήξη της πρόσβασής σου 🎁`
      : `+${days} ${plan} days added after your current access ends 🎁`
  }
  return lang === 'el'
    ? `Κέρδισες ${days} μέρες δωρεάν πλάνο ${plan} 🎁`
    : `You earned ${days} days free ${plan} plan 🎁`
}

export function emptyRewardsSnapshot(): RewardsSnapshot {
  return { pending: [], claimed_level_ids: [], active_grants: [] }
}

/** Drop a claimed level from a snapshot so the banner cannot come back. */
export function markRewardClaimed(
  rewards: RewardsSnapshot | null | undefined,
  levelId: number,
): RewardsSnapshot {
  const base = rewards || emptyRewardsSnapshot()
  const claimed = new Set([...(base.claimed_level_ids || []), levelId])
  return {
    ...base,
    pending: (base.pending || []).filter((p) => p.level_id !== levelId && !claimed.has(p.level_id)),
    claimed_level_ids: Array.from(claimed),
  }
}

export function excludeClaimedRewards(
  rewards: RewardsSnapshot | null | undefined,
  claimedIds: Iterable<number>,
): RewardsSnapshot | null {
  if (!rewards) return null
  let next = rewards
  const add = (id: number) => {
    next = markRewardClaimed(next, id)
  }
  if (claimedIds instanceof Set || Array.isArray(claimedIds)) {
    claimedIds.forEach(add)
  }
  return next
}

export function isAlreadyClaimedError(message: string): boolean {
  return /already claimed|ήδη διεκδικ|already been claimed/i.test(message || '')
}

const REWARD_DISMISS_PREFIX = 'hm_reward_dismiss_'
const REWARD_CLAIMED_PREFIX = 'hm_reward_claimed_'

function readStoredLevelIds(key: string): Set<number> {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.map(Number).filter((n) => n > 1) : [])
  } catch {
    return new Set()
  }
}

function writeStoredLevelIds(key: string, ids: Set<number>): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(Array.from(ids)))
  } catch {
    /* ignore */
  }
}

function rewardStorageKey(prefix: string, token: string): string {
  return `${prefix}${token.slice(-12)}`
}

export function readDismissedRewardLevels(token: string): Set<number> {
  if (!token) return new Set()
  return readStoredLevelIds(rewardStorageKey(REWARD_DISMISS_PREFIX, token))
}

export function dismissRewardLevel(token: string, levelId: number): void {
  if (!token || levelId < 2) return
  const key = rewardStorageKey(REWARD_DISMISS_PREFIX, token)
  const set = readStoredLevelIds(key)
  set.add(levelId)
  writeStoredLevelIds(key, set)
}

export function readLocallyClaimedRewardLevels(token: string): Set<number> {
  if (!token) return new Set()
  return readStoredLevelIds(rewardStorageKey(REWARD_CLAIMED_PREFIX, token))
}

export function persistLocallyClaimedRewardLevel(token: string, levelId: number): void {
  if (!token || levelId < 2) return
  const key = rewardStorageKey(REWARD_CLAIMED_PREFIX, token)
  const set = readStoredLevelIds(key)
  set.add(levelId)
  writeStoredLevelIds(key, set)
}

export function firstUnseenPendingReward(
  token: string,
  rewards: RewardsSnapshot | null | undefined,
) {
  if (!rewards?.pending?.length) return null
  const dismissed = readDismissedRewardLevels(token)
  const claimed = readLocallyClaimedRewardLevels(token)
  return rewards.pending.find((p) => !dismissed.has(p.level_id) && !claimed.has(p.level_id)) ?? null
}

/** Pick which pending reward to show — prefer a specific level (e.g. fresh level-up). */
export function selectPendingReward(
  rewards: RewardsSnapshot | null | undefined,
  options?: { token?: string; levelId?: number; force?: boolean; claimedIds?: Iterable<number> },
): PendingLevelReward | null {
  if (!rewards?.pending?.length) return null
  const claimed = new Set<number>()
  if (options?.claimedIds instanceof Set || Array.isArray(options?.claimedIds)) {
    options.claimedIds.forEach((id) => claimed.add(id))
  }
  const pending = rewards.pending.filter((p) => !claimed.has(p.level_id))
  if (!pending.length) return null
  const filtered: RewardsSnapshot = { ...rewards, pending }
  if (options?.levelId != null) {
    const match = pending.find((p) => p.level_id === options.levelId)
    if (match) return match
  }
  if (options?.force) {
    return pending[0] ?? null
  }
  if (options?.token) {
    return firstUnseenPendingReward(options.token, filtered)
  }
  return pending[0] ?? null
}
