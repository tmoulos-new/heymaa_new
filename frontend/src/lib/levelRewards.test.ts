import {
  excludeClaimedRewards,
  markRewardClaimed,
  isAlreadyClaimedError,
  persistLocallyClaimedRewardLevel,
  readLocallyClaimedRewardLevels,
  selectPendingReward,
} from './levelRewards'

describe('level reward claim UX helpers', () => {
  const snapshot = {
    pending: [
      { level_id: 2, plan_slot: 'starter' as const, days: 3 },
      { level_id: 3, plan_slot: 'starter' as const, days: 7 },
    ],
    claimed_level_ids: [] as number[],
    active_grants: [],
  }

  beforeEach(() => {
    sessionStorage.clear()
  })

  it('removes the claimed gift so the banner cannot reopen it', () => {
    const next = markRewardClaimed(snapshot, 2)
    expect(next.pending.map((p) => p.level_id)).toEqual([3])
    expect(next.claimed_level_ids).toContain(2)
  })

  it('filters a stale snapshot against locally claimed ids', () => {
    const next = excludeClaimedRewards(snapshot, [2, 3])
    expect(next?.pending).toEqual([])
  })

  it('treats already-claimed API errors as success', () => {
    expect(isAlreadyClaimedError('Reward already claimed')).toBe(true)
    expect(isAlreadyClaimedError('Claim failed')).toBe(false)
  })

  it('never returns a locally claimed gift even with force', () => {
    const next = selectPendingReward(snapshot, { force: true, claimedIds: [2] })
    expect(next?.level_id).toBe(3)
    expect(selectPendingReward(snapshot, { force: true, claimedIds: [2, 3] })).toBeNull()
  })

  it('persists claimed ids so a remount cannot reopen the same banner', () => {
    persistLocallyClaimedRewardLevel('tok_abc123456789', 2)
    const ids = readLocallyClaimedRewardLevels('tok_abc123456789')
    expect(ids.has(2)).toBe(true)
    expect(selectPendingReward(snapshot, { claimedIds: ids })?.level_id).toBe(3)
  })
})
