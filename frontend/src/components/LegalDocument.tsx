import { useTranslation } from 'react-i18next'

export type LegalSection = {
  heading: string
  paragraphs?: string[]
  list?: string[]
}

function asSections(value: unknown): LegalSection[] {
  return Array.isArray(value) ? (value as LegalSection[]) : []
}

export function LegalDocument({ docKey }: { docKey: 'terms' | 'privacy' }) {
  const { t } = useTranslation()
  const tl = (key: string, opts?: Record<string, unknown>) => t(key, { ns: 'legal', ...opts })
  const title = tl(`${docKey}.title`)
  const sections = asSections(tl(`${docKey}.sections`, { returnObjects: true }))

  return (
    <>
      <h1 className="sec-title">{title}</h1>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
          {section.list?.length ? (
            <ul>
              {section.list.map((item) => (
                <li key={item.slice(0, 40)}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </>
  )
}
