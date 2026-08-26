export type ToastKind = 'ok' | 'err'

export type ToastItem = {
  id: number
  text: string
  kind: ToastKind
  undo?: () => void
  undoLabel?: string
}

type Props = {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
  onUndo?: (toast: ToastItem) => void
  dismissLabel?: string
}

export function ToastStack({ toasts, onDismiss, onUndo, dismissLabel = 'Dismiss' }: Props) {
  if (toasts.length === 0) return null

  return (
    <div className="hm-toast-stack">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`hm-toast hm-toast--${toast.kind}`}
          role={toast.kind === 'err' ? 'alert' : 'status'}
          aria-live={toast.kind === 'err' ? 'assertive' : 'polite'}
        >
          <span className="hm-toast__icon" aria-hidden="true">
            {toast.kind === 'err' ? '!' : '✓'}
          </span>
          <span className="hm-toast__text">{toast.text}</span>
          {toast.undo && onUndo ? (
            <button
              type="button"
              className="hm-toast__undo"
              onClick={() => onUndo(toast)}
            >
              {toast.undoLabel || 'Undo'}
            </button>
          ) : (
            <button
              type="button"
              className="hm-toast__dismiss"
              aria-label={dismissLabel}
              onClick={() => onDismiss(toast.id)}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
