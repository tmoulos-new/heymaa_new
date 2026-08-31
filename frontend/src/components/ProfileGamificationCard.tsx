import type { GamificationStatus } from '../lib/userGamification'
import { levelName } from '../lib/userGamification'
import {
  POINT_ACTIONS,
  REFERRAL_BONUS_POINTS,
  levelEmoji,
} from '../lib/gamificationCard'

import type { PendingLevelReward } from '../lib/levelRewards'
import { rewardDescription, rewardTitle } from '../lib/levelRewards'

type Props = {
  lang: string
  gamification: GamificationStatus
  referralCode?: string | null
  activeGrantEndsAt?: string | null
  activeGrantPlan?: string | null
  pendingRewards?: PendingLevelReward[]
  onClaimPending?: () => void
}

export function ProfileGamificationCard({
  lang,
  gamification,
  referralCode,
  activeGrantEndsAt,
  activeGrantPlan,
  pendingRewards,
  onClaimPending,
}: Props) {
  const isEl = lang === 'el'
  const { level, points, progress_percent, points_to_next, level: currentLevel } = gamification
  const emoji = levelEmoji(level.number)
  const pending = pendingRewards?.[0]

  return (
    <div className="hm-profile-gamification-card">
      <div className="hm-profile-gamification-card__head">
        <div className="hm-profile-gamification-card__level-badge" aria-hidden="true">
          {emoji}
        </div>
        <div className="hm-profile-gamification-card__level-copy">
          <div className="hm-profile-gamification-card__level-name">
            {levelName(currentLevel, lang)}
          </div>
          <div className="hm-profile-gamification-card__points">
            {points} {isEl ? 'πόντοι' : 'points'}
          </div>
        </div>
        <div className="hm-profile-gamification-card__progress">
          <div className="hm-profile-gamification-card__progress-label">
            {isEl ? 'Επόμενο επίπεδο' : 'Next level'}
          </div>
          <div
            className="hm-profile-gamification-card__progress-track"
            role="progressbar"
            aria-valuenow={progress_percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="hm-profile-gamification-card__progress-fill"
              style={{ width: `${progress_percent}%` }}
            />
          </div>
          <div className="hm-profile-gamification-card__progress-remaining">
            {level.is_max
              ? isEl
                ? 'Μέγιστο επίπεδο'
                : 'Max level'
              : isEl
                ? `${points_to_next} ακόμα`
                : `${points_to_next} to go`}
          </div>
        </div>
      </div>

      {pending && onClaimPending ? (
        <>
          <div className="hm-profile-gamification-card__divider" />
          <button type="button" className="hm-profile-gamification-card__gift-btn" onClick={onClaimPending}>
            <span className="hm-profile-gamification-card__gift-btn-icon" aria-hidden="true">🎁</span>
            <span className="hm-profile-gamification-card__gift-btn-copy">
              <span className="hm-profile-gamification-card__gift-btn-title">
                {isEl ? 'Δώρο σε αναμονή' : 'Gift waiting'}
              </span>
              <span className="hm-profile-gamification-card__gift-btn-sub">
                {rewardTitle(pending.level_id, lang)} · {rewardDescription(pending, lang)}
              </span>
            </span>
          </button>
        </>
      ) : null}

      <div className="hm-profile-gamification-card__divider" />

      <p className="hm-profile-gamification-card__progress-hint">
        {activeGrantEndsAt && activeGrantPlan
          ? isEl
            ? `Ενεργό δωρεάν ${activeGrantPlan} μέχρι ${new Date(activeGrantEndsAt).toLocaleDateString('el-GR')}.`
            : `Active free ${activeGrantPlan} until ${new Date(activeGrantEndsAt).toLocaleDateString('en-GB')}.`
          : isEl
            ? 'Η πρόοδός σου αντανακλά τη δραστηριότητά σου στην εφαρμογή — chat, αναμνήσεις και ορόσημα.'
            : 'Your progress reflects your activity in the app — chat, memories, and milestones.'}
      </p>

      <div className="hm-profile-gamification-card__divider" />

      <p className="hm-profile-gamification-card__actions">
        {POINT_ACTIONS.map((action, i) => (
          <span key={action.en}>
            {i > 0 ? ' • ' : null}
            {isEl ? action.el : action.en} +{action.points}
          </span>
        ))}
      </p>

      {referralCode ? (
        <>
          <div className="hm-profile-gamification-card__divider" />
          <div className="hm-profile-gamification-card__referral">
            <p className="hm-profile-gamification-card__referral-code">
              {isEl ? 'Κωδικός πρόσκλησης:' : 'Invite code:'}{' '}
              <strong>{referralCode}</strong>
            </p>
            <p className="hm-profile-gamification-card__referral-bonus">
              {isEl
                ? `+${REFERRAL_BONUS_POINTS} πόντοι για κάθε φίλη που εγγράφεται!`
                : `+${REFERRAL_BONUS_POINTS} points for every friend who signs up!`}
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
