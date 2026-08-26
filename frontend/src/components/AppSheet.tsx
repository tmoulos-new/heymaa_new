import { useEffect, type ReactNode } from 'react'
import { AppModalPortal } from './AppModalPortal'
import { useBodyScrollLock } from '../lib/useBodyScrollLock'

type Props = {
  open: boolean
  onClose: () => void
  children: ReactNode
  wide?: boolean
  ariaLabel?: string
  closeOnBackdrop?: boolean
}

export function AppSheet({
  open,
  onClose,
  children,
  wide = false,
  ariaLabel,
  closeOnBackdrop = true,
}: Props) {
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <AppModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="hm-sheet-overlay"
        onClick={(e) => {
          if (closeOnBackdrop && e.target === e.currentTarget) onClose()
        }}
      >
        <div
          className={`hm-sheet-panel hm-sheet-panel--scroll${wide ? ' hm-sheet-panel--wide' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </AppModalPortal>
  )
}
