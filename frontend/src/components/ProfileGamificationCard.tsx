import type { GamificationStatus } from '../lib/userGamification'
import { levelName } from '../lib/userGamification'
import {
  POINT_ACTIONS,
  REFERRAL_BONUS_POINTS,
  levelEmoji,
} from '../lib/gamificationCard'

type Props = {
  lang: string
  gamification: GamificationStatus
  referralCode?: string | null
}

export function ProfileGamificationCard({ lang, gamification, referralCode }: Props) {
  const isEl = lang === 'el'
  const { level, points, progress_percent, points_to_next, level: currentLevel } = gamification
  const emoji = levelEmoji(level.number)

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

      <div className="hm-profile-gamification-card__divider" />

      <p className="hm-profile-gamification-card__progress-hint">
        {isEl
          ? 'Η πρόοδός σου αντακλά τη δραστηριότητά σου στην εφαρμογή — chat, αναμνήσεις και ορόσημα.'
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
