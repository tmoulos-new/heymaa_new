import { useEffect, useId, useRef, useState } from 'react'
import { AppSheet } from './AppSheet'
import { RewardCelebration } from './RewardCelebration'
import { levelEmoji } from '../lib/gamificationCard'
import { displayUppercase } from '../lib/greekText'
import type { PendingLevelReward, RewardsSnapshot } from '../lib/levelRewards'
import {
  claimSuccessMessage,
  effectiveRewardDescription,
  isAlreadyClaimedError,
  levelUpKicker,
  markRewardClaimed,
  rewardClaimBody,
  rewardTitle,
} from '../lib/levelRewards'
import { claimLevelReward } from '../lib/levelRewardsApi'
import type { SubscriptionSnapshot } from '../lib/authApi'

export type LevelRewardClaimedPayload = {
  rewards?: RewardsSnapshot
  status?: SubscriptionSnapshot
  grant?: { upgraded?: boolean; plan_slot?: string; days?: number }
  levelId: number
}

type Props = {
  open: boolean
  lang: string
  token: string
  reward: PendingLevelReward | null
  currentPlanSlot?: string | null
  onClose: () => void
  onClaimed: (payload: LevelRewardClaimedPayload) => void
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
  const busyRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)
  const prevOpenRef = useRef(false)
  const prevLevelRef = useRef<number | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')
  const [celebrate, setCelebrate] = useState(false)
  const [done, setDone] = useState(false)
  const [successGrant, setSuccessGrant] = useState<{
    upgraded?: boolean
    plan_slot?: string
    days?: number
  } | null>(null)

  useEffect(() => {
    const justOpened = open && !prevOpenRef.current
    const rewardChanged = open && prevLevelRef.current !== (reward?.level_id ?? null)
    prevOpenRef.current = open
    prevLevelRef.current = reward?.level_id ?? null
    if (!open || (!justOpened && !rewardChanged)) return
    busyRef.current = false
    setError('')
    setClaiming(false)
    setCelebrate(false)
    setDone(false)
    setSuccessGrant(null)
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [reward?.level_id, open])

  useEffect(() => () => {
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current)
  }, [])

  if (!reward) return null

  const emoji = levelEmoji(reward.level_id)
  const levelName = rewardTitle(reward.level_id, lang)
  const giftLine = effectiveRewardDescription(reward, lang, currentPlanSlot)
  const body = rewardClaimBody(reward, lang, currentPlanSlot)
  const successLine = claimSuccessMessage(successGrant || undefined, lang)
  const locked = claiming || done

  const finishSuccess = (payload: {
    rewards?: RewardsSnapshot
    status?: SubscriptionSnapshot
    grant?: { upgraded?: boolean; plan_slot?: string; days?: number }
  }) => {
    setDone(true)
    setCelebrate(true)
    setClaiming(false)
    setSuccessGrant(payload.grant || {
      plan_slot: reward.plan_slot,
      days: reward.days,
    })
    onClaimed({ ...payload, levelId: reward.level_id })
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      onClose()
    }, 1600) as unknown as number
  }

  const handleClaim = async () => {
    if (busyRef.current || done) return
    busyRef.current = true
    setClaiming(true)
    setError('')
    try {
      const result = await claimLevelReward(token, reward.level_id)
      finishSuccess({
        rewards: result.rewards
          ? markRewardClaimed(result.rewards, reward.level_id)
          : undefined,
        status: result.status,
        grant: result.grant,
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : isEl ? 'Αποτυχία διεκδίκησης' : 'Claim failed'
      if (isAlreadyClaimedError(message)) {
        finishSuccess({
          grant: { plan_slot: reward.plan_slot, days: reward.days },
        })
        return
      }
      busyRef.current = false
      setClaiming(false)
      setError(message)
    }
  }

  const handleClose = () => {
    if (claiming && !done) return
    onClose()
  }

  return (
    <>
      <RewardCelebration active={celebrate} />
      <AppSheet
        open={open}
        onClose={handleClose}
        dialog
        closeOnBackdrop={!locked}
        preventClose={claiming && !done}
        titleId={titleId}
      >
        <div className="hm-reward-sheet">
          <div className="hm-reward-sheet__emoji" aria-hidden="true">
            {done ? '🎁' : emoji}
          </div>
          <p className="hm-reward-sheet__kicker">
            {displayUppercase(done ? (isEl ? 'Το δώρο ενεργοποιήθηκε' : 'Gift activated') : levelUpKicker(lang), lang)}
          </p>
          <h2 id={titleId} className="hm-reward-sheet__title">
            {done ? successLine.replace(/ 🎁$/, '') : levelName}
          </h2>
          {done ? null : (
            <>
              <p className="hm-reward-sheet__level">{giftLine}</p>
              <p className="hm-reward-sheet__body">{body}</p>
            </>
          )}
          {error ? <p className="hm-reward-sheet__error">{error}</p> : null}
          <div className="hm-reward-sheet__actions">
            <button
              type="button"
              className={`hm-reward-sheet__claim${done ? ' hm-reward-sheet__claim--done' : ''}`}
              disabled={claiming && !done}
              aria-busy={claiming && !done}
              onClick={() => {
                if (done) handleClose()
                else void handleClaim()
              }}
            >
              {claiming && !done
                ? isEl
                  ? 'Ενεργοποίηση…'
                  : 'Activating…'
                : done
                  ? isEl
                    ? 'Τέλεια!'
                    : 'Done!'
                  : isEl
                    ? 'Πάρε το δώρο σου! 🎁'
                    : 'Claim your gift! 🎁'}
            </button>
            {done ? null : (
              <button type="button" className="hm-reward-sheet__later" onClick={handleClose} disabled={claiming}>
                {isEl ? 'Αργότερα' : 'Later'}
              </button>
            )}
          </div>
        </div>
      </AppSheet>
    </>
  )
}
