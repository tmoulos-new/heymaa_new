import { useState } from 'react'
import type { GamificationStatus } from '../lib/userGamification'
import { copyText, levelName, sendReferralInvite } from '../lib/userGamification'
import {
  getReferralBonusPoints,
  levelEmoji,
} from '../lib/gamificationCard'

import type { PendingLevelReward } from '../lib/levelRewards'
import { effectiveRewardDescription, rewardTitle } from '../lib/levelRewards'
import { IconCopy, IconShare } from './ui/LineIcons'

type Props = {
  lang: string
  gamification: GamificationStatus
  referralCode?: string | null
  activeGrantEndsAt?: string | null
  activeGrantPlan?: string | null
  currentPlanSlot?: string | null
  pendingRewards?: PendingLevelReward[]
  onClaimPending?: () => void
  showHeaderChip?: boolean
  onToggleHeaderChip?: () => void
  onOpenFaq?: () => void
}

export function ProfileGamificationCard({
  lang,
  gamification,
  referralCode,
  activeGrantEndsAt,
  activeGrantPlan,
  currentPlanSlot,
  pendingRewards,
  onClaimPending,
  showHeaderChip,
  onToggleHeaderChip,
  onOpenFaq,
}: Props) {
  const isEl = lang === 'el'
  const { level, points, progress_percent, points_to_next, level: currentLevel } = gamification
  const emoji = levelEmoji(level.number)
  const pending = pendingRewards?.[0]
  const [referralFeedback, setReferralFeedback] = useState<string | null>(null)

  const flashReferral = (message: string) => {
    setReferralFeedback(message)
    window.setTimeout(() => setReferralFeedback((cur) => (cur === message ? null : cur)), 2200)
  }

  const handleCopyCode = async () => {
    if (!referralCode) return
    const ok = await copyText(referralCode)
    flashReferral(ok
      ? (isEl ? 'Ο κωδικός αντιγράφηκε' : 'Code copied')
      : (isEl ? 'Δεν έγινε αντιγραφή' : 'Could not copy'))
  }

  const handleSendInvite = async () => {
    if (!referralCode) return
    const result = await sendReferralInvite(referralCode, lang)
    if (result === 'cancelled') return
    if (result === 'shared') {
      flashReferral(isEl ? 'Η πρόσκληση άνοιξε' : 'Invite opened')
      return
    }
    flashReferral(result === 'copied'
      ? (isEl ? 'Ο σύνδεσμος αντιγράφηκε — στείλε τον στη φίλη σου' : 'Link copied — send it to your friend')
      : (isEl ? 'Δεν στάλθηκε η πρόσκληση' : 'Could not send invite'))
  }

  return (
    <div className="hm-profile-gamification-card" id="hm-profile-gamification">
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
            aria-valuetext={
              level.is_max
                ? (isEl ? 'Μέγιστο επίπεδο' : 'Max level')
                : (isEl ? `${progress_percent}% — ${points_to_next} πόντοι ακόμα` : `${progress_percent}% — ${points_to_next} points to go`)
            }
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
                {rewardTitle(pending.level_id, lang)} · {effectiveRewardDescription(pending, lang, currentPlanSlot)}
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

      {onToggleHeaderChip ? (
        <>
          <div className="hm-profile-gamification-card__divider" />
          <button
            type="button"
            className="hm-profile-gamification-card__header-toggle"
            role="switch"
            aria-checked={!!showHeaderChip}
            aria-label={isEl ? 'Εμφάνιση πόντων στο header' : 'Show points in header'}
            onClick={onToggleHeaderChip}
          >
            <span className="hm-profile-gamification-card__header-toggle-copy">
              {isEl ? 'Εμφάνιση πόντων στο header' : 'Show points in header'}
            </span>
            <span className={`hm-settings-switch${showHeaderChip ? ' is-on' : ''}`} aria-hidden="true">
              <span className="hm-settings-switch__knob" />
            </span>
          </button>
        </>
      ) : null}

      {onOpenFaq ? (
        <>
          <div className="hm-profile-gamification-card__divider" />
          <button type="button" className="hm-profile-gamification-card__faq-link" onClick={onOpenFaq}>
            {isEl ? 'Πώς κερδίζεις πόντους; Δες τις Συχνές ερωτήσεις →' : 'How do points work? See the FAQ →'}
          </button>
        </>
      ) : null}

      {referralCode ? (
        <>
          <div className="hm-profile-gamification-card__divider" />
          <div className="hm-profile-gamification-card__referral">
            <p className="hm-profile-gamification-card__referral-label">
              {isEl ? 'Κωδικός πρόσκλησης' : 'Invite code'}
            </p>
            <button
              type="button"
              className="hm-profile-gamification-card__referral-code-btn"
              onClick={() => void handleCopyCode()}
              aria-label={isEl ? `Αντιγραφή κωδικού ${referralCode}` : `Copy code ${referralCode}`}
            >
              <strong>{referralCode}</strong>
              <IconCopy size={15} />
            </button>
            <p className="hm-profile-gamification-card__referral-bonus">
              {isEl
                ? `+${getReferralBonusPoints()} πόντοι για κάθε φίλη που εγγράφεται!`
                : `+${getReferralBonusPoints()} points for every friend who signs up!`}
            </p>
            <button
              type="button"
              className="hm-profile-gamification-card__referral-send"
              onClick={() => void handleSendInvite()}
            >
              <IconShare size={16} />
              {isEl ? 'Προσκάλεσε φίλη' : 'Invite a friend'}
            </button>
            {referralFeedback ? (
              <p className="hm-profile-gamification-card__referral-feedback" role="status">
                {referralFeedback}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
