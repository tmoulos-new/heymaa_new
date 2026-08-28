import { useState } from 'react'
import { AppSheet } from './AppSheet'
import { RewardCelebration } from './RewardCelebration'
import { levelEmoji } from '../lib/gamificationCard'
import type { PendingLevelReward } from '../lib/levelRewards'
import { rewardDescription, rewardTitle } from '../lib/levelRewards'
import { claimLevelReward } from '../lib/levelRewardsApi'
import type { SubscriptionSnapshot } from '../lib/authApi'
import type { RewardsSnapshot } from '../lib/levelRewards'

type Props = {
  open: boolean
  lang: string
  token: string
  reward: PendingLevelReward | null
  onClose: () => void
  onClaimed: (payload: {
    rewards: RewardsSnapshot
    status?: SubscriptionSnapshot
  }) => void
}

export function LevelUpRewardSheet({
  open,
  lang,
  token,
  reward,
  onClose,
  onClaimed,
}: Props) {
  const isEl = lang === 'el'
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')
  const [celebrate, setCelebrate] = useState(false)

  if (!reward) return null

  const emoji = levelEmoji(reward.level_id)
  const title = rewardTitle(reward.level_id, lang)
  const desc = rewardDescription(reward, lang)

  const handleClaim = async () => {
    setClaiming(true)
    setError('')
    try {
      const result = await claimLevelReward(token, reward.level_id)
      if (result.rewards) {
        setCelebrate(true)
        onClaimed({ rewards: result.rewards, status: result.status })
      }
      onClose()
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
      closeOnBackdrop={!claiming}
      ariaLabel={isEl ? 'Ανταμοιβή επιπέδου' : 'Level reward'}
    >
      <div className="hm-reward-sheet">
        <div className="hm-reward-sheet__emoji" aria-hidden="true">
          {emoji}
        </div>
        <h2 className="hm-reward-sheet__title">
          {isEl ? 'Νέο επίπεδο!' : 'Level up!'}
        </h2>
        <p className="hm-reward-sheet__level">{title}</p>
        <p className="hm-reward-sheet__body">
          {isEl
            ? `Κέρδισες: ${desc}. Διεκδίκησέ το τώρα — ενεργοποιείται αμέσως και στοιβάζεται με τυχόν ενεργό δωρεάν πακέτο.`
            : `You earned: ${desc}. Claim now — it activates immediately and stacks with any active free plan.`}
        </p>
        {error ? <p className="hm-reward-sheet__error">{error}</p> : null}
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
    </AppSheet>
    </>
  )
}
