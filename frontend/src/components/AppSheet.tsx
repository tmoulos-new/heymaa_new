import { useRef, type ReactNode } from 'react'
import { AppModalPortal } from './AppModalPortal'
import { useBodyScrollLock } from '../lib/useBodyScrollLock'
import { useModalFocus } from '../lib/useModalFocus'

type Props = {
  open: boolean
  onClose: () => void
  children: ReactNode
  wide?: boolean
  /** Centered card on all viewports (reward / expiry dialogs). */
  dialog?: boolean
  /** Fallback label when titleId is not set */
  ariaLabel?: string
  /** Visible title element id — preferred over ariaLabel */
  titleId?: string
  closeOnBackdrop?: boolean
}

export function AppSheet({
  open,
  onClose,
  children,
  wide = false,
  dialog = false,
  ariaLabel,
  titleId,
  closeOnBackdrop = true,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useBodyScrollLock(open)
  useModalFocus(panelRef, open, onClose)

  if (!open) return null

  return (
    <AppModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titleId ? undefined : ariaLabel}
        aria-labelledby={titleId}
        className={`hm-sheet-overlay${dialog ? ' hm-sheet-overlay--dialog' : ''}`}
        onClick={(e) => {
          if (closeOnBackdrop && e.target === e.currentTarget) onClose()
        }}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`hm-sheet-panel hm-sheet-panel--scroll${wide ? ' hm-sheet-panel--wide' : ''}${dialog ? ' hm-sheet-panel--dialog' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </AppModalPortal>
  )
}
