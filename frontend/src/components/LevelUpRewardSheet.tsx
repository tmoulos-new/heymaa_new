import { useEffect, useId, useState } from 'react'
import { AppSheet } from './AppSheet'
import { RewardCelebration } from './RewardCelebration'
import { levelEmoji, levelRewardsText } from '../lib/gamificationCard'
import type { PendingLevelReward } from '../lib/levelRewards'
import {
  effectiveRewardDescription,
  isRewardUpgradedForPlan,
  rewardClaimBody,
  rewardTitle,
} from '../lib/levelRewards'
import { claimLevelReward } from '../lib/levelRewardsApi'
import type { SubscriptionSnapshot } from '../lib/authApi'
import type { RewardsSnapshot } from '../lib/levelRewards'

type Props = {
  open: boolean
  lang: string
  token: string
  reward: PendingLevelReward | null
  currentPlanSlot?: string | null
  onClose: () => void
  onClaimed: (payload: {
    rewards: RewardsSnapshot
    status?: SubscriptionSnapshot
    grant?: { upgraded?: boolean; plan_slot?: string; days?: number }
  }) => void
}

export function LevelUpRewardSheet({
  open,
  lang,
  token,
  reward,
  currentPlanSlot,
  onClose,
  onClaimed,
}: Props) {
  const isEl = lang === 'el'
  const titleId = useId()
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    setError('')
    setClaiming(false)
    setCelebrate(false)
  }, [reward?.level_id, open])

  if (!reward) return null

  const emoji = levelEmoji(reward.level_id)
  const levelName = rewardTitle(reward.level_id, lang)
  const rewardLine = levelRewardsText(reward.level_id, lang)
  const body = rewardClaimBody(reward, lang, currentPlanSlot)

  const handleClaim = async () => {
    setClaiming(true)
    setError('')
    try {
      const result = await claimLevelReward(token, reward.level_id)
      if (result.rewards) {
        setCelebrate(true)
        onClaimed({
          rewards: result.rewards,
          status: result.status,
          grant: result.grant,
        })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : isEl ? 'Αποτυχία διεκδίκησης' : 'Claim failed')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <>
      <RewardCelebration active={celebrate} onDone={() => setCelebrate(false)} />
      <AppSheet
        open={open}
        onClose={onClose}
        dialog
        closeOnBackdrop={!claiming}
        titleId={titleId}
      >
        <div className="hm-reward-sheet">
          <div className="hm-reward-sheet__emoji" aria-hidden="true">
            {emoji}
          </div>
          <p className="hm-reward-sheet__kicker">
            {isEl ? `Επίπεδο ${reward.level_id}` : `Level ${reward.level_id}`}
          </p>
          <h2 id={titleId} className="hm-reward-sheet__title">{levelName}</h2>
          <p className="hm-reward-sheet__level">
            {isRewardUpgradedForPlan(reward, currentPlanSlot)
              ? effectiveRewardDescription(reward, lang, currentPlanSlot)
              : rewardLine}
          </p>
          <p className="hm-reward-sheet__body">{body}</p>
          {error ? <p className="hm-reward-sheet__error">{error}</p> : null}
          <div className="hm-reward-sheet__actions">
            <button
              type="button"
              className="hm-reward-sheet__claim"
              disabled={claiming}
              onClick={() => void handleClaim()}
            >
              {claiming
                ? isEl
                  ? 'Ενεργοποίηση…'
                  : 'Activating…'
                : isEl
                  ? 'Πάρε το δώρο σου! 🎁'
                  : 'Claim your gift! 🎁'}
            </button>
            <button type="button" className="hm-reward-sheet__later" onClick={onClose} disabled={claiming}>
              {isEl ? 'Αργότερα' : 'Later'}
            </button>
          </div>
        </div>
      </AppSheet>
    </>
  )
}
