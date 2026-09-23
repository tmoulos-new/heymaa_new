import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
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
  /** `dialog` = grouped cards + denser reading layout for the FAQ popup. */
  variant?: 'page' | 'dialog'
}

type FaqGroup = {
  label: string
  startIndex: number
  items: FaqItem[]
}

function clusterByGroup(items: FaqItem[]): FaqGroup[] {
  const groups: FaqGroup[] = []
  items.forEach((item, i) => {
    const label = (item.group || '').trim()
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.items.push(item)
      return
    }
    groups.push({ label, startIndex: i, items: [item] })
  })
  return groups
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
  variant = 'page',
}: Props) {
  const reactId = useId()
  const idPrefix = idPrefixProp || `faq${reactId.replace(/:/g, '')}`
  const [internalOpen, setInternalOpen] = useState<number | null>(defaultOpenIndex)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])
  const controlled = openIndexProp !== undefined
  const openIndex = controlled ? openIndexProp : internalOpen
  const groups = useMemo(() => clusterByGroup(items), [items])

  const setOpenIndex = useCallback(
    (index: number | null) => {
      if (controlled) onOpenIndexChange?.(index)
      else setInternalOpen(index)
    },
    [controlled, onOpenIndexChange],
  )

  const revealOpenedItem = useCallback((index: number, block: ScrollLogicalPosition = 'nearest') => {
    if (!scrollIntoViewOnOpen) return
    const itemEl = itemRefs.current[index]
    if (!itemEl) return

    const scrollParentEl = findScrollParent(itemEl)
    const scrollTopBefore = scrollParentEl?.scrollTop ?? 0

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        itemEl.scrollIntoView({ block, inline: 'nearest', behavior: 'auto' })
        const panel = itemEl.querySelector<HTMLElement>('.hm-faq-panel--open .hm-faq-panel__inner')
        panel?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
        if (block === 'nearest' && scrollParentEl && scrollParentEl.scrollTop < scrollTopBefore - 48) {
          scrollParentEl.scrollTop = scrollTopBefore
          itemEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
        }
      })
    })
  }, [scrollIntoViewOnOpen])

  useEffect(() => {
    if (openIndex == null || !scrollIntoViewOnOpen) return
    const t = window.setTimeout(() => revealOpenedItem(openIndex, 'start'), 50)
    return () => window.clearTimeout(t)
  }, [openIndex, scrollIntoViewOnOpen, revealOpenedItem, items.length])

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

  const renderItem = (item: FaqItem, flatIndex: number) => {
    const open = openIndex === flatIndex
    const triggerId = `${idPrefix}-trigger-${flatIndex}`
    const panelId = `${idPrefix}-panel-${flatIndex}`
    return (
      <div
        key={`${item.question}-${flatIndex}`}
        ref={(el) => {
          itemRefs.current[flatIndex] = el
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
            onClick={() => toggle(flatIndex)}
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
  }

  if (variant === 'dialog') {
    return (
      <div className="hm-faq-list hm-faq-list--dialog" role="presentation">
        {groups.map((group) => (
          <section
            key={`${group.label || 'ungrouped'}-${group.startIndex}`}
            className="hm-faq-group"
            aria-label={group.label || undefined}
          >
            {group.label ? (
              <h2 className="hm-faq-group__label">{group.label}</h2>
            ) : null}
            <div className="hm-faq-group__card">
              {group.items.map((item, offset) => renderItem(item, group.startIndex + offset))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="hm-faq-list" role="presentation">
      {items.map((item, i) => {
        const group = (item.group || '').trim()
        const showGroup = Boolean(group) && (i === 0 || (items[i - 1]?.group || '').trim() !== group)
        return (
          <Fragment key={`${item.question}-${i}`}>
            {showGroup ? (
              <div className="hm-faq-group-label" role="presentation">
                {group}
              </div>
            ) : null}
            {renderItem(item, i)}
          </Fragment>
        )
      })}
    </div>
  )
}
