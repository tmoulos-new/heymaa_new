import type { ReactNode } from 'react'

type Props = {
  variant?: 'white' | 'cream'
  padding?: 'md' | 'lg'
  className?: string
  children: ReactNode
}

export function DialogPanel({
  variant = 'cream',
  padding = 'md',
  className = '',
  children,
}: Props) {
  return (
    <div
      className={`hm-dialog-panel hm-dialog-panel--${variant} hm-dialog-panel--pad-${padding}${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  )
}
