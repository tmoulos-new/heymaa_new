import { useMemo } from 'react'
import type { SubscriptionSnapshot } from '../lib/authApi'
import { getTrialBannerInfo } from '../lib/appNotifications'

type Props = {
  lang: string
  trialEndsAt?: string | null
  subSnapshot: SubscriptionSnapshot | null
  onOpenSubscriptionSheet: () => void
}

export function AppTrialBanner({
  lang,
  trialEndsAt,
  subSnapshot,
  onOpenSubscriptionSheet,
}: Props) {
  const isEl = lang === 'el'
  const info = useMemo(
    () => getTrialBannerInfo(lang, trialEndsAt, subSnapshot),
    [lang, trialEndsAt, subSnapshot],
  )

  if (!info) return null

  const { daysLeft, endLabel, urgent, endsToday } = info

  const message = endsToday
    ? isEl
      ? 'Η δωρεάν δοκιμή λήγει σήμερα'
      : 'Your free trial ends today'
    : daysLeft === 1
      ? isEl
        ? 'Απομένει 1 ημέρα στη δωρεάν δοκιμή'
        : '1 day left on your free trial'
      : isEl
        ? `Απομένουν ${daysLeft} ημέρες στη δωρεάν δοκιμή`
        : `${daysLeft} days left on your free trial`

  const cta = isEl ? 'Δες πλάνα' : 'View plans'

  return (
    <div
      className={`hm-trial-banner${urgent ? ' hm-trial-banner--urgent' : ''}`}
      role="status"
    >
      <div className="hm-trial-banner-text">
        <span className="hm-trial-banner-icon" aria-hidden="true">
          {urgent ? '⏳' : '✨'}
        </span>
        <span className="hm-trial-banner-copy">
          <span className="hm-trial-banner-title">{message}</span>
          <span className="hm-trial-banner-sub">
            {isEl ? `Λήγει ${endLabel}` : `Ends ${endLabel}`}
          </span>
        </span>
      </div>
      <button
        type="button"
        className="hm-trial-banner-cta"
        onClick={onOpenSubscriptionSheet}
      >
        {cta}
      </button>
    </div>
  )
}
