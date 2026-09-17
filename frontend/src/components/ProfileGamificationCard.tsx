import { useState } from 'react'
import type { GamificationStatus } from '../lib/userGamification'
import { copyText, levelName, sendReferralInvite } from '../lib/userGamification'
import {
  GAMIFICATION_LEVELS,
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

const RING_R = 38
const RING_C = 2 * Math.PI * RING_R

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
  const { level, points, progress_percent, points_to_next, next_level } = gamification
  const emoji = levelEmoji(level.number)
  const pending = pendingRewards?.[0]
  const [referralFeedback, setReferralFeedback] = useState<string | null>(null)
  const pct = Math.max(0, Math.min(100, progress_percent))
  const dashOffset = RING_C * (1 - pct / 100)
  const grantActive = Boolean(activeGrantEndsAt && activeGrantPlan)
  const nextName = next_level ? levelName(next_level, lang) : null

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

  const activityChips = isEl
    ? [
        { icon: '💬', label: 'Chat' },
        { icon: '📷', label: 'Αναμνήσεις' },
        { icon: '🏆', label: 'Ορόσημα' },
      ]
    : [
        { icon: '💬', label: 'Chat' },
        { icon: '📷', label: 'Memories' },
        { icon: '🏆', label: 'Milestones' },
      ]

  return (
    <div className="hm-profile-gamification-card" id="hm-profile-gamification">
      <div className="hm-profile-gamification-card__hero">
        <span className="hm-profile-gamification-card__blob hm-profile-gamification-card__blob--a" aria-hidden="true" />
        <span className="hm-profile-gamification-card__blob hm-profile-gamification-card__blob--b" aria-hidden="true" />

        <div className="hm-profile-gamification-card__hero-row">
          <div className="hm-profile-gamification-card__ring" aria-hidden="true">
            <svg viewBox="0 0 88 88" className="hm-profile-gamification-card__ring-svg">
              <circle className="hm-profile-gamification-card__ring-track" cx="44" cy="44" r={RING_R} />
              <circle
                className="hm-profile-gamification-card__ring-fill"
                cx="44"
                cy="44"
                r={RING_R}
                strokeDasharray={RING_C}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <span className="hm-profile-gamification-card__ring-emoji">{emoji}</span>
          </div>

          <div className="hm-profile-gamification-card__hero-copy">
            <p className="hm-profile-gamification-card__kicker">
              {isEl ? `Επίπεδο ${level.number}` : `Level ${level.number}`}
            </p>
            <h3 className="hm-profile-gamification-card__level-name">
              {levelName(level, lang)}
            </h3>
            <p className="hm-profile-gamification-card__points">
              <strong>{points}</strong>
              <span>{isEl ? 'πόντοι' : 'points'}</span>
            </p>
          </div>
        </div>

        <div className="hm-profile-gamification-card__progress">
          <div className="hm-profile-gamification-card__progress-copy">
            <span>
              {level.is_max
                ? (isEl ? 'Μέγιστο επίπεδο' : 'Max level')
                : (isEl
                  ? `Επόμενο: ${nextName ?? 'επόμενο επίπεδο'}`
                  : `Next: ${nextName ?? 'next level'}`)}
            </span>
            <span>
              {level.is_max
                ? (isEl ? 'Τα κατάφερες' : 'You made it')
                : (isEl ? `${points_to_next} ακόμα` : `${points_to_next} to go`)}
            </span>
          </div>
          <div
            className="hm-profile-gamification-card__progress-track"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={
              level.is_max
                ? (isEl ? 'Μέγιστο επίπεδο' : 'Max level')
                : (isEl ? `${pct}% — ${points_to_next} πόντοι ακόμα` : `${pct}% — ${points_to_next} points to go`)
            }
          >
            <div
              className="hm-profile-gamification-card__progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <ol className="hm-profile-gamification-card__pips" aria-hidden="true">
            {GAMIFICATION_LEVELS.map((row) => {
              const state = row.number < level.number ? 'done' : row.number === level.number ? 'now' : 'next'
              return (
                <li key={row.number} className={`hm-profile-gamification-card__pip is-${state}`}>
                  <span>{levelEmoji(row.number)}</span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <div className="hm-profile-gamification-card__body">
        {pending && onClaimPending ? (
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
        ) : null}

        {grantActive ? (
          <p className="hm-profile-gamification-card__grant">
            {isEl
              ? `Ενεργό δωρεάν ${activeGrantPlan} μέχρι ${new Date(activeGrantEndsAt as string).toLocaleDateString('el-GR')}.`
              : `Active free ${activeGrantPlan} until ${new Date(activeGrantEndsAt as string).toLocaleDateString('en-GB')}.`}
          </p>
        ) : null}

        <div className="hm-profile-gamification-card__chips">
          {activityChips.map((chip) => (
            <span key={chip.label} className="hm-profile-gamification-card__chip">
              <span aria-hidden="true">{chip.icon}</span>
              {chip.label}
            </span>
          ))}
          {onOpenFaq ? (
            <button type="button" className="hm-profile-gamification-card__faq-link" onClick={onOpenFaq}>
              {isEl ? 'Πώς κερδίζεις πόντους;' : 'How do points work?'}
            </button>
          ) : null}
        </div>

        {onToggleHeaderChip ? (
          <div className="hm-profile-gamification-card__tools">
            <button
              type="button"
              className="hm-profile-gamification-card__header-toggle"
              role="switch"
              aria-checked={!!showHeaderChip}
              aria-label={isEl ? 'Εμφάνιση πόντων στο header' : 'Show points in header'}
              onClick={onToggleHeaderChip}
            >
              <span className="hm-profile-gamification-card__header-toggle-copy">
                {isEl ? 'Πόντοι στο header' : 'Points in header'}
              </span>
              <span className={`hm-settings-switch${showHeaderChip ? ' is-on' : ''}`} aria-hidden="true">
                <span className="hm-settings-switch__knob" />
              </span>
            </button>
          </div>
        ) : null}

        {referralCode ? (
          <div className="hm-profile-gamification-card__referral">
            <div className="hm-profile-gamification-card__referral-copy">
              <p className="hm-profile-gamification-card__referral-label">
                {isEl ? 'Κωδικός πρόσκλησης' : 'Invite code'}
              </p>
              <p className="hm-profile-gamification-card__referral-bonus">
                {isEl
                  ? `+${getReferralBonusPoints()} πόντοι για κάθε φίλη που εγγράφεται`
                  : `+${getReferralBonusPoints()} points for every friend who signs up`}
              </p>
            </div>
            <button
              type="button"
              className="hm-profile-gamification-card__referral-code-btn"
              onClick={() => void handleCopyCode()}
              aria-label={isEl ? `Αντιγραφή κωδικού ${referralCode}` : `Copy code ${referralCode}`}
            >
              <strong>{referralCode}</strong>
              <IconCopy size={15} />
            </button>
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
        ) : null}
      </div>
    </div>
  )
}
