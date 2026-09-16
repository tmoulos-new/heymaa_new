import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  )
}

/** Trap focus inside a modal/sheet, restore focus on close, handle Escape + Tab. */
export function useModalFocus(
  containerRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const focusInitial = window.setTimeout(() => {
      const root = containerRef.current
      if (!root) return
      // Don't steal focus if the user already focused a field inside the dialog
      // (e.g. while typing — onClose identity changes must not re-run autofocus).
      if (root.contains(document.activeElement)) return
      const items = focusableElements(root)
      if (items.length > 0) {
        items[0].focus()
      } else {
        root.focus()
      }
    }, 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      const root = containerRef.current
      if (!root) return
      const items = focusableElements(root)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusInitial)
      window.removeEventListener('keydown', onKeyDown)
      const restore = restoreFocusRef.current
      if (restore?.isConnected) {
        restore.focus()
      }
    }
    // Intentionally omit onClose — keep it in a ref so inline () => ... callers
    // don't re-run autofocus on every parent render (breaks text inputs).
  }, [open, containerRef])
}
