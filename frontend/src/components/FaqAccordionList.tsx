import { useId, useState } from 'react'
import { FaqAnswerBody } from './FaqAnswerBody'
import type { HomeFaqItem } from '../i18n/homeTypes'
import { toggleFaqAccordionIndex } from '../lib/useFaqAccordion'

export type FaqItem = HomeFaqItem

type Props = {
  items: FaqItem[]
  /** Controlled open index (single item). Omit for uncontrolled. */
  openIndex?: number | null
  onOpenIndexChange?: (index: number | null) => void
  /** Initial open item when uncontrolled (default: none). */
  defaultOpenIndex?: number | null
  idPrefix?: string
}

export function FaqAccordionList({
  items,
  openIndex: openIndexProp,
  onOpenIndexChange,
  defaultOpenIndex = null,
  idPrefix: idPrefixProp,
}: Props) {
  const reactId = useId()
  const idPrefix = idPrefixProp || `faq${reactId.replace(/:/g, '')}`
  const [internalOpen, setInternalOpen] = useState<number | null>(defaultOpenIndex)
  const controlled = openIndexProp !== undefined
  const openIndex = controlled ? openIndexProp : internalOpen

  const setOpenIndex = (index: number | null) => {
    if (controlled) onOpenIndexChange?.(index)
    else setInternalOpen(index)
  }

  const toggle = (index: number) => {
    setOpenIndex(toggleFaqAccordionIndex(openIndex, index))
  }

  return (
    <div className="hm-faq-list" role="presentation">
      {items.map((item, i) => {
        const open = openIndex === i
        const triggerId = `${idPrefix}-trigger-${i}`
        const panelId = `${idPrefix}-panel-${i}`
        return (
          <div
            key={`${item.question}-${i}`}
            className={`hm-faq-item${open ? ' hm-faq-item--open' : ''}`}
          >
            <h3 className="hm-faq-item__heading">
              <button
                type="button"
                id={triggerId}
                className="hm-faq-trigger"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(i)}
              >
                <span className="hm-faq-trigger__q">{item.question}</span>
                <span
                  className={`hm-faq-trigger__chevron${open ? ' hm-faq-trigger__chevron--open' : ''}`}
                  aria-hidden="true"
                >
                  ›
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              aria-hidden={!open}
              className={`hm-faq-panel${open ? ' hm-faq-panel--open' : ''}`}
            >
              <div className="hm-faq-panel__inner">
                <div className="hm-faq-answer">
                  <FaqAnswerBody item={item} />
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
