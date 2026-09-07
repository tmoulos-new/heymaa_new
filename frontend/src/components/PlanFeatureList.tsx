import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { normalizePlanFeatures, resolveFeatureHint } from '../lib/planFeatureHints'

type Props = {
  features: unknown
  layout?: 'stack' | 'grid' | 'checkout'
  className?: string
}

export function PlanFeatureList({ features, layout = 'stack', className }: Props) {
  const { t: tBase } = useTranslation()
  const tHome = (key: string, opts?: Record<string, unknown>) =>
    tBase(key, { ns: 'home', ...opts })
  const listId = useId()
  const items = normalizePlanFeatures(features)
  const hints = tHome('pricing.featureHints', { returnObjects: true }) as Record<string, string>
  const infoLabel = String(tHome('pricing.infoLabel', { defaultValue: 'What this means' }))
  const [openKey, setOpenKey] = useState<string | null>(null)

  const rootClass = [
    layout === 'checkout' ? 'checkout-plan-feats' : 'plan-feats',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <ul className={rootClass}>
      {items.map((feature, index) => {
        const info = resolveFeatureHint(hints, feature.hint)
        const rowKey = `${feature.label}-${index}`
        const infoId = `${listId}-info-${index}`
        const open = openKey === rowKey

        return (
          <li key={rowKey}>
            <i className="ti ti-check" aria-hidden="true" />
            <span className="plan-feat-body">
              <span className="plan-feat-label-row">
                <span>{feature.label}</span>
                {info ? (
                  <button
                    type="button"
                    className="plan-feat-info-btn"
                    aria-expanded={open}
                    aria-controls={infoId}
                    aria-label={`${infoLabel}: ${feature.label}`}
                    onClick={() => setOpenKey(open ? null : rowKey)}
                  >
                    i
                  </button>
                ) : null}
              </span>
              {info && open ? (
                <p id={infoId} className="plan-feat-info-text" role="note">
                  {info}
                </p>
              ) : null}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
