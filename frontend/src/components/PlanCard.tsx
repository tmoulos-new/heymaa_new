import type { HomePlan } from '../i18n/homeTypes'
import { goToVivaCheckout, vivaPlanForVariant, type VivaPlanKey } from '../lib/vivaCheckout'

export type PlanButtonState = 'current' | 'idle' | 'selected'

export function PlanCard({
  plan,
  disabled,
  onButtonClick,
  onCheckout,
  onSelect,
  layout = 'stack',
  buttonState,
  selectMode = false,
  radioSelected,
}: {
  plan: HomePlan
  disabled?: boolean
  onButtonClick?: () => void
  onCheckout?: (product: VivaPlanKey) => void
  onSelect?: () => void
  layout?: 'stack' | 'grid'
  buttonState?: PlanButtonState
  selectMode?: boolean
  radioSelected?: boolean
}) {
  const isCurrent = plan.variant === 'current'
  const productKey = vivaPlanForVariant(plan.variant)
  const isDisabled = disabled ?? (isCurrent && !selectMode)
  const resolvedButtonState: PlanButtonState =
    buttonState ??
    (isCurrent ? 'current' : plan.featured ? 'selected' : 'idle')
  const isSelected = resolvedButtonState === 'selected'
  const isRadioFilled = radioSelected ?? isSelected

  const handleClick = () => {
    if (selectMode) {
      if (isCurrent || isSelected) return
      onSelect?.()
      return
    }
    if (isDisabled) return
    if (onButtonClick) {
      onButtonClick()
      return
    }
    if (!productKey) return
    if (onCheckout) onCheckout(productKey)
    else goToVivaCheckout(productKey)
  }

  if (layout === 'grid') {
    return (
      <div
        className={`plan plan-grid ${plan.variant}`}
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

  const planClassName = [
    'plan',
    'plan-stack',
    plan.variant,
    isRadioFilled ? 'selected' : '',
    isCurrent ? 'current' : '',
    plan.featured || plan.badge ? 'highlighted' : '',
    plan.badge ? 'has-badge' : '',
    selectMode && !isCurrent && !isSelected ? 'selectable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={planClassName}
      onClick={
        selectMode && !isCurrent && !isSelected
          ? () => onSelect?.()
          : undefined
      }
    >
      {plan.badge ? (
        <div
          className="plan-badge-corner"
          style={{ background: plan.badgeColor || 'var(--navy)' }}
        >
          {plan.badge}
        </div>
      ) : null}
      <div className="plan-top">
        <div className="plan-icon-wrap" aria-hidden="true">
          {plan.icon}
        </div>
        <div
          className={`plan-radio${isRadioFilled ? ' filled' : ''}`}
          aria-hidden="true"
        >
          <span className="plan-radio-dot" />
        </div>
      </div>
      <div className="plan-meta">
        <div className="plan-name-row">
          <div className="plan-name">{plan.name}</div>
        </div>
        <div className="plan-price-row">
          {!isCurrent && plan.price ? (
            <span className="plan-price">{plan.price}</span>
          ) : null}
          {plan.period ? (
            <span className="plan-period">{plan.period}</span>
          ) : null}
        </div>
        {plan.save ? (
          <div className="plan-save">{plan.save}</div>
        ) : (
          <div className="plan-save plan-save-empty" aria-hidden="true">
            {'\u00a0'}
          </div>
        )}
      </div>
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
        className={`plan-btn btn-plan-${resolvedButtonState}`}
        disabled={selectMode ? isCurrent || isSelected : isDisabled}
        onClick={handleClick}
      >
        {plan.button}
      </button>
    </div>
  )
}
