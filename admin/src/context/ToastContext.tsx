import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type ToastKind = 'ok' | 'err' | 'info'

type Toast = { id: number; text: string; kind: ToastKind }

type ToastContextValue = {
  showToast: (text: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((text: string, kind: ToastKind = 'ok') => {
    const trimmed = text.trim()
    if (!trimmed) return
    const id = ++nextId
    setToasts((prev) => [...prev, { id, text: trimmed, kind }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite" aria-relevant="additions">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`} role="status">
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
