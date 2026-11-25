import { useState } from 'react'
import type { GamificationStatus } from '../lib/userGamification'
import { copyText, levelName, sendReferralInvite } from '../lib/userGamification'
import {
  GAMIFICATION_LEVELS,
  getReferralBonusPoints,
  levelEmoji,
  levelRewardsText,
} from '../lib/gamificationCard'
import { pickL } from '../lib/appLang'

import type { PendingLevelReward } from '../lib/levelRewards'
import {
  activeGrantMessage,
  effectiveRewardDescription,
  liveLevelPlanRewards,
  rewardTitle,
} from '../lib/levelRewards'
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
  onOpenFaq?: (topic: 'points' | 'levels') => void
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
  const { level, points, progress_percent, points_to_next, next_level } = gamification
  const emoji = levelEmoji(level.number)
  const pending = pendingRewards?.[0]
  const [referralFeedback, setReferralFeedback] = useState<string | null>(null)
  const pct = Math.max(0, Math.min(100, progress_percent))
  const dashOffset = RING_C * (1 - pct / 100)
  const grantActive = Boolean(activeGrantEndsAt && activeGrantPlan)
  const nextName = next_level ? levelName(next_level, lang) : null

  const nextGiftDescription = (() => {
    if (level.is_max || !next_level) return null
    const row = liveLevelPlanRewards().find((r) => r.levelId === next_level.number)
    if (row) {
      return effectiveRewardDescription(
        { level_id: row.levelId, plan_slot: row.planSlot, days: row.days },
        lang,
        currentPlanSlot,
      )
    }
    const fallback = levelRewardsText(next_level.number, lang)
    if (/Χωρίς δώρο|No gift|Fără cadou/i.test(fallback)) return null
    return fallback
  })()

  const flashReferral = (message: string) => {
    setReferralFeedback(message)
    window.setTimeout(() => setReferralFeedback((cur) => (cur === message ? null : cur)), 2200)
  }

  const handleCopyCode = async () => {
    if (!referralCode) return
    const ok = await copyText(referralCode)
    flashReferral(ok
      ? pickL(lang, 'Ο κωδικός αντιγράφηκε', 'Code copied', 'Cod copiat')
      : pickL(lang, 'Δεν έγινε αντιγραφή', 'Could not copy', 'Nu s-a putut copia'))
  }

  const handleSendInvite = async () => {
    if (!referralCode) return
    const result = await sendReferralInvite(referralCode, lang)
    if (result === 'cancelled') return
    if (result === 'shared') {
      flashReferral(pickL(lang, 'Η πρόσκληση άνοιξε', 'Invite opened', 'Invitația s-a deschis'))
      return
    }
    flashReferral(result === 'copied'
      ? pickL(
          lang,
          'Ο σύνδεσμος αντιγράφηκε — στείλε τον στη φίλη σου',
          'Link copied — send it to your friend',
          'Link copiat — trimite-l prietenei tale',
        )
      : pickL(lang, 'Δεν στάλθηκε η πρόσκληση', 'Could not send invite', 'Invitația nu a fost trimisă'))
  }

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
              {pickL(lang, `Επίπεδο ${level.number}`, `Level ${level.number}`, `Nivel ${level.number}`)}
            </p>
            <h3 className="hm-profile-gamification-card__level-name">
              {levelName(level, lang)}
            </h3>
            <p className="hm-profile-gamification-card__points">
              <strong>{points}</strong>
              <span>{pickL(lang, 'πόντοι', 'points', 'puncte')}</span>
            </p>
          </div>
        </div>

        <div className="hm-profile-gamification-card__progress">
          <div className="hm-profile-gamification-card__progress-copy">
            <span>
              {level.is_max
                ? pickL(lang, 'Μέγιστο επίπεδο', 'Max level', 'Nivel maxim')
                : pickL(
                    lang,
                    `Επόμενο: ${nextName ?? 'επόμενο επίπεδο'}`,
                    `Next: ${nextName ?? 'next level'}`,
                    `Următorul: ${nextName ?? 'următorul nivel'}`,
                  )}
            </span>
            <span>
              {level.is_max
                ? pickL(lang, 'Τα κατάφερες', 'You made it', 'Ai reușit')
                : pickL(lang, `${points_to_next} ακόμα`, `${points_to_next} to go`, `${points_to_next} rămase`)}
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
                ? pickL(lang, 'Μέγιστο επίπεδο', 'Max level', 'Nivel maxim')
                : pickL(
                    lang,
                    `${pct}% — ${points_to_next} πόντοι ακόμα`,
                    `${pct}% — ${points_to_next} points to go`,
                    `${pct}% — ${points_to_next} puncte rămase`,
                  )
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
                {pickL(lang, 'Δώρο σε αναμονή', 'Gift waiting', 'Cadou în așteptare')}
              </span>
              <span className="hm-profile-gamification-card__gift-btn-sub">
                {rewardTitle(pending.level_id, lang)} · {effectiveRewardDescription(pending, lang, currentPlanSlot)}
              </span>
            </span>
          </button>
        ) : null}

        {nextGiftDescription && nextName ? (
          <div className="hm-profile-gamification-card__next-gift" role="status">
            <span className="hm-profile-gamification-card__next-gift-icon" aria-hidden="true">✨</span>
            <span className="hm-profile-gamification-card__next-gift-copy">
              <span className="hm-profile-gamification-card__next-gift-title">
                {pickL(
                  lang,
                  `Δώρο στο «${nextName}»`,
                  `Gift at “${nextName}”`,
                  `Cadou la „${nextName}”`,
                )}
              </span>
              <span className="hm-profile-gamification-card__next-gift-sub">
                {pickL(
                  lang,
                  `Φτάσε εκεί και κέρδισε ${nextGiftDescription}.`,
                  `Reach it and earn ${nextGiftDescription}.`,
                  `Ajunge acolo și câștigă ${nextGiftDescription}.`,
                )}
              </span>
            </span>
          </div>
        ) : null}

        {grantActive ? (
          <p className="hm-profile-gamification-card__grant">
            {activeGrantMessage(activeGrantPlan as string, activeGrantEndsAt as string, lang)}
          </p>
        ) : null}

        {onOpenFaq ? (
          <div className="hm-profile-gamification-card__chips">
            <button
              type="button"
              className="hm-profile-gamification-card__faq-link"
              onClick={() => onOpenFaq('points')}
            >
              {pickL(lang, 'Πώς κερδίζεις πόντους;', 'How do points work?', 'Cum funcționează punctele?')}
            </button>
            <button
              type="button"
              className="hm-profile-gamification-card__faq-link"
              onClick={() => onOpenFaq('levels')}
            >
              {pickL(lang, 'Τι είναι τα επίπεδα;', 'What are levels?', 'Ce sunt nivelurile?')}
            </button>
          </div>
        ) : null}

        {onToggleHeaderChip ? (
          <div className="hm-profile-gamification-card__tools">
            <button
              type="button"
              className="hm-profile-gamification-card__header-toggle"
              role="switch"
              aria-checked={!!showHeaderChip}
              aria-label={pickL(lang, 'Εμφάνιση πόντων στο header', 'Show points in header', 'Afișează punctele în header')}
              onClick={onToggleHeaderChip}
            >
              <span className="hm-profile-gamification-card__header-toggle-copy">
                {pickL(lang, 'Πόντοι στο header', 'Points in header', 'Puncte în header')}
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
                {pickL(lang, 'Κωδικός πρόσκλησης', 'Invite code', 'Cod de invitație')}
              </p>
              <p className="hm-profile-gamification-card__referral-bonus">
                {pickL(
                  lang,
                  `+${getReferralBonusPoints()} πόντοι για κάθε φίλη που εγγράφεται`,
                  `+${getReferralBonusPoints()} points for every friend who signs up`,
                  `+${getReferralBonusPoints()} puncte pentru fiecare prietenă care se înscrie`,
                )}
              </p>
            </div>
            <button
              type="button"
              className="hm-profile-gamification-card__referral-code-btn"
              onClick={() => void handleCopyCode()}
              aria-label={pickL(lang, `Αντιγραφή κωδικού ${referralCode}`, `Copy code ${referralCode}`, `Copiază codul ${referralCode}`)}
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
              {pickL(lang, 'Προσκάλεσε φίλη', 'Invite a friend', 'Invită o prietenă')}
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
