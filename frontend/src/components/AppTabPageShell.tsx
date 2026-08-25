import type { ReactNode } from 'react'
import { displayUppercase } from '../lib/greekText'

export function AppTabPageShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="hm-tab-page">
      <div className="hm-tab-page-head">
        <div className="hm-tab-page-head-text">
          <h1 className="hm-tab-page-title">{title}</h1>
          {subtitle ? <p className="hm-tab-page-subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div className="hm-tab-page-action">{action}</div> : null}
      </div>
      {children}
    </div>
  )
}

export function AppTabSection({
  label,
  lang,
  action,
  children,
}: {
  label: string
  lang: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="hm-tab-section">
      <div className="hm-tab-section-head">
        <h2 className="hm-tab-section-label">{displayUppercase(label, lang)}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
