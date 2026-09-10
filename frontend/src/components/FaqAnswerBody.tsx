import { useTranslation } from 'react-i18next'
import type { HomeFaqItem } from '../i18n/homeTypes'
import { displayUppercase } from '../lib/greekText'

type Props = {
  item: HomeFaqItem
}

export function FaqAnswerBody({ item }: Props) {
  const { i18n } = useTranslation()
  const intro = item.answer?.trim()
  const sections = item.sections?.filter(
    (s) => s.title || s.intro || (s.bullets && s.bullets.length > 0),
  )

  if (!sections?.length) {
    if (!intro) return null
    return <div className="hm-faq-answer__plain">{intro}</div>
  }

  return (
    <div className="hm-faq-answer__rich">
      {intro ? <p className="hm-faq-answer__intro">{intro}</p> : null}
      {sections.map((section, i) => (
        <div key={`${section.title || 'section'}-${i}`} className="hm-faq-answer__section">
          {section.title ? (
            <h4 className="hm-faq-answer__section-title">
              {displayUppercase(section.title, i18n.language)}
            </h4>
          ) : null}
          {section.intro ? <p className="hm-faq-answer__section-intro">{section.intro}</p> : null}
          {section.bullets?.length ? (
            <ul className="hm-faq-answer__list">
              {section.bullets.map((bullet, j) => (
                <li key={j}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  )
}
