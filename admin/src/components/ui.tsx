import { useEffect, useState, type ReactNode } from 'react'

export function Message({
  text,
  kind,
}: {
  text: string
  kind: 'ok' | 'err' | 'info'
}) {
  if (!text) return null
  return <div className={`msg ${kind}`}>{text}</div>
}

export function useFlashMessage(timeoutMs = 4000) {
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' | 'info' } | null>(null)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), timeoutMs)
    return () => clearTimeout(t)
  }, [msg, timeoutMs])

  const show = (text: string, kind: 'ok' | 'err' | 'info' = 'ok') => setMsg({ text, kind })

  return { msg, show, Message: msg ? <Message text={msg.text} kind={msg.kind} /> : null }
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
