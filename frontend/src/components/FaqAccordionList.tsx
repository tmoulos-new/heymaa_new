export type FaqItem = {
  question: string
  answer: string
}

type Props = {
  items: FaqItem[]
  openMap: Record<number, boolean>
  onToggle: (index: number) => void
}

export function FaqAccordionList({ items, openMap, onToggle }: Props) {
  return (
    <div className="hm-faq-list">
      {items.map((item, i) => {
        const open = !!openMap[i]
        return (
          <div key={`${item.question}-${i}`} className="hm-faq-item">
            <button
              type="button"
              className="hm-faq-trigger"
              aria-expanded={open}
              onClick={() => onToggle(i)}
            >
              <span className="hm-faq-trigger__q">{item.question}</span>
              <span
                className={`hm-faq-trigger__chevron${open ? ' hm-faq-trigger__chevron--open' : ''}`}
                aria-hidden="true"
              >
                ›
              </span>
            </button>
            {open ? <div className="hm-faq-answer">{item.answer}</div> : null}
          </div>
        )
      })}
    </div>
  )
}
