import { useCallback, type ReactNode } from 'react'
import { useToast, type ToastKind } from '../context/ToastContext'

export function useFlashMessage() {
  const { showToast } = useToast()
  const show = useCallback(
    (text: string, kind: ToastKind = 'ok') => showToast(text, kind),
    [showToast],
  )
  return { show, Message: null }
}

export function FieldLabel({
  children,
  required,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="field">
      {children}
      {required && (
        <span className="req" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  )
}
