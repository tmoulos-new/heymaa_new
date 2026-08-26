import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AppModalPortal } from './AppModalPortal'
import { useBodyScrollLock } from '../lib/useBodyScrollLock'

type Props = {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Visible title — also used for aria-labelledby when set */
  title?: string
  /** Override auto-generated title id */
  titleId?: string
  /** Fallback when there is no visible title element */
  ariaLabel?: string
  size?: 'sm' | 'md' | 'lg'
  align?: 'center' | 'bottom'
  closeOnBackdrop?: boolean
  panelClassName?: string
}

export function AppDialog({
  open,
  onClose,
  children,
  title,
  titleId: titleIdProp,
  ariaLabel,
  size = 'md',
  align = 'center',
  closeOnBackdrop = true,
  panelClassName = '',
}: Props) {
  const autoTitleId = useId()
  const titleId = titleIdProp || autoTitleId
  const panelRef = useRef<HTMLDivElement>(null)

  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => panelRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  if (!open) return null

  const labelledBy = title ? titleId : undefined

  return (
    <AppModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={!labelledBy ? ariaLabel : undefined}
        aria-labelledby={labelledBy}
        className={`hm-overlay${align === 'bottom' ? ' hm-overlay--bottom' : ''}`}
        onClick={(e) => {
          if (closeOnBackdrop && e.target === e.currentTarget) onClose()
        }}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`hm-dialog hm-dialog--${size}${panelClassName ? ` ${panelClassName}` : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {title ? (
            <h2 id={titleId} className="hm-sr-only">
              {title}
            </h2>
          ) : null}
          {children}
        </div>
      </div>
    </AppModalPortal>
  )
}
