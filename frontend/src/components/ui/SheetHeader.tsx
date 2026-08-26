import type { ReactNode } from 'react'

type Props = {
  title: ReactNode
  subtitle?: ReactNode
  onBack: () => void
  backLabel: string
  /** When true, title row is vertically centered with back button (settings style). */
  compact?: boolean
}

export function SheetHeader({ title, subtitle, onBack, backLabel, compact = false }: Props) {
  return (
    <div className={`hm-sheet-header${compact ? ' hm-sheet-header--compact' : ''}`}>
      <button type="button" className="hm-icon-btn-back" aria-label={backLabel} onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className="hm-sheet-header__text">
        <h1 className="hm-dialog-title">{title}</h1>
        {subtitle ? <p className="hm-dialog-subtitle">{subtitle}</p> : null}
      </div>
    </div>
  )
}
