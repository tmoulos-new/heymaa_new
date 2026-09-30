import type { ReactNode } from 'react'

/** Short how-to strip used under a card title (3 steps on desktop). */
export function AdminHowto({
  title = 'How this works',
  steps,
}: {
  title?: string
  steps: { title: string; body: string }[]
}) {
  return (
    <div className="admin-howto" role="note">
      <div className="admin-howto-title">{title}</div>
      <ol className="admin-howto-steps">
        {steps.map((s) => (
          <li key={s.title}>
            <strong>{s.title}</strong>
            <span>{s.body}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Inline warning / tip callout. */
export function AdminCallout({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'warn'
}) {
  return (
    <div className={`admin-callout admin-callout-${tone}`} role="note">
      {children}
    </div>
  )
}
