type Props = {
  lang: string
  featureLabel: string
  requiredPlanLabel: string
  onUpgrade: () => void
  compact?: boolean
}

export function FeatureUpgradeGate({
  lang,
  featureLabel,
  requiredPlanLabel,
  onUpgrade,
  compact = false,
}: Props) {
  const el = lang === 'el'

  return (
    <div className={`hm-feature-gate${compact ? ' hm-feature-gate--compact' : ''}`}>
      <p className="hm-feature-gate__text">
        {el
          ? `Το feature «${featureLabel}» είναι διαθέσιμο μόνο στο πακέτο ${requiredPlanLabel}.`
          : `«${featureLabel}» is only available on the ${requiredPlanLabel} plan.`}
      </p>
      <p className="hm-feature-gate__sub">
        {el
          ? 'Κάνε upgrade το πλάνο σου για να το χρησιμοποιήσεις.'
          : 'Upgrade your plan to use it.'}
      </p>
      <button type="button" className="hm-feature-gate__btn" onClick={onUpgrade}>
        {el ? 'UPGRADE' : 'UPGRADE'}
      </button>
    </div>
  )
}
