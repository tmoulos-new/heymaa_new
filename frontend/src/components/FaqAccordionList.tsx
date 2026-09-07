import { useCallback, useId, useRef, useState } from 'react'
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
  /** Keep opened question in view inside scrollable dialogs (default: true). */
  scrollIntoViewOnOpen?: boolean
}

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const style = window.getComputedStyle(node)
    const overflowY = style.overflowY
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node
    }
    node = node.parentElement
  }
  return null
}

export function FaqAccordionList({
  items,
  openIndex: openIndexProp,
  onOpenIndexChange,
  defaultOpenIndex = null,
  idPrefix: idPrefixProp,
  scrollIntoViewOnOpen = true,
}: Props) {
  const reactId = useId()
  const idPrefix = idPrefixProp || `faq${reactId.replace(/:/g, '')}`
  const [internalOpen, setInternalOpen] = useState<number | null>(defaultOpenIndex)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])
  const controlled = openIndexProp !== undefined
  const openIndex = controlled ? openIndexProp : internalOpen

  const setOpenIndex = useCallback(
    (index: number | null) => {
      if (controlled) onOpenIndexChange?.(index)
      else setInternalOpen(index)
    },
    [controlled, onOpenIndexChange],
  )

  const revealOpenedItem = useCallback((index: number) => {
    if (!scrollIntoViewOnOpen) return
    const itemEl = itemRefs.current[index]
    const trigger = itemEl?.querySelector<HTMLElement>('.hm-faq-trigger')
    if (!trigger) return

    const scrollParentEl = findScrollParent(itemEl)
    const scrollTopBefore = scrollParentEl?.scrollTop ?? 0

    // Wait for close/open layout — double rAF after grid height transition starts.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        trigger.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
        // scrollIntoView can over-correct in modals; if we jumped upward a lot, nudge back slightly.
        if (scrollParentEl && scrollParentEl.scrollTop < scrollTopBefore - 48) {
          scrollParentEl.scrollTop = scrollTopBefore
          trigger.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
        }
      })
    })
  }, [scrollIntoViewOnOpen])

  const toggle = useCallback(
    (index: number) => {
      const closingIndex = openIndex
      const next = toggleFaqAccordionIndex(openIndex, index)
      const opening = next === index

      if (
        opening
        && closingIndex !== null
        && closingIndex !== index
        && closingIndex < index
      ) {
        const scrollEl = findScrollParent(itemRefs.current[index])
        const closingItem = itemRefs.current[closingIndex]
        const closingPanel = closingItem?.querySelector<HTMLElement>('.hm-faq-panel__inner')
        const collapseBy = closingPanel?.getBoundingClientRect().height ?? 0

        setOpenIndex(next)

        if (scrollEl && collapseBy > 0) {
          scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop - collapseBy)
        }
        revealOpenedItem(index)
        return
      }

      setOpenIndex(next)
      if (opening) revealOpenedItem(index)
    },
    [openIndex, revealOpenedItem, setOpenIndex],
  )

  return (
    <div className="hm-faq-list" role="presentation">
      {items.map((item, i) => {
        const open = openIndex === i
        const triggerId = `${idPrefix}-trigger-${i}`
        const panelId = `${idPrefix}-panel-${i}`
        return (
          <div
            key={`${item.question}-${i}`}
            ref={(el) => {
              itemRefs.current[i] = el
            }}
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
