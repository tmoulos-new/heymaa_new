import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/** Renders modals on document.body so they sit above the in-app header (avoids overflow/stacking traps). */
export function AppModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
