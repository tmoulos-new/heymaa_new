import type { HomePlan } from '../i18n/homeTypes'
import { goToVivaCheckout, vivaPlanForVariant, type VivaPlanKey } from '../lib/vivaCheckout'

export function PlanCard({
  plan,
  disabled,
  onButtonClick,
  onCheckout,
}: {
  plan: HomePlan
  disabled?: boolean
  onButtonClick?: () => void
  onCheckout?: (product: VivaPlanKey) => void
}) {
  const isCurrent = plan.variant === 'current'
  const productKey = vivaPlanForVariant(plan.variant)
  const isDisabled = disabled ?? isCurrent

  const handleClick = () => {
    if (isDisabled) return
    if (onButtonClick) {
      onButtonClick()
      return
    }
    if (!productKey) return
    if (onCheckout) onCheckout(productKey)
    else goToVivaCheckout(productKey)
  }

  return (
    <div
      className={`plan ${plan.variant}`}
      style={{ marginTop: plan.badge ? '14px' : '0' }}
    >
      {plan.badge ? (
        <div className="plan-badge" style={{ background: plan.badgeColor }}>
          {plan.badge}
        </div>
      ) : null}
      <div className="plan-ico">{plan.icon}</div>
      <div className="plan-name">{plan.name}</div>
      <div className="plan-price">{plan.price}</div>
      <div className="plan-period">{plan.period}</div>
      <div className="plan-save">{plan.save || '\u00a0'}</div>
      <ul className="plan-feats">
        {plan.features.map((feature) => (
          <li key={feature}>
            <i className="ti ti-check" />
            {feature}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`plan-btn ${plan.buttonClass}`}
        disabled={isDisabled}
        onClick={handleClick}
      >
        {plan.button}
      </button>
    </div>
  )
}
