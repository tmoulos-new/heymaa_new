import { useTranslation } from 'react-i18next'
import { legalDocumentLang } from '../lib/legalLocale'
import { readStoredAppLang } from '../lib/appLang'

export type LegalSection = {
  heading: string
  paragraphs?: string[]
  htmlParagraphs?: string[]
  list?: string[]
}

function asSections(value: unknown): LegalSection[] {
  return Array.isArray(value) ? (value as LegalSection[]) : []
}

export function LegalDocument({ docKey }: { docKey: 'terms' | 'privacy' }) {
  const { t } = useTranslation()
  const docLang = legalDocumentLang(readStoredAppLang('el'))
  const tl = (key: string, opts?: Record<string, unknown>) =>
    t(key, { ns: 'legal', lng: docLang, ...opts })
  const title = tl(`${docKey}.title`)
  const sections = asSections(tl(`${docKey}.sections`, { returnObjects: true }))
  const notice =
    docLang === 'en'
      ? t('notice', { ns: 'legal', lng: docLang, defaultValue: '' })
      : ''

  return (
    <>
      <h1 className="sec-title">{title}</h1>
      {notice ? <p className="legal-notice">{notice}</p> : null}
      {sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
          {section.htmlParagraphs?.map((html) => (
            <p key={html.slice(0, 40)} dangerouslySetInnerHTML={{ __html: html }} />
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
