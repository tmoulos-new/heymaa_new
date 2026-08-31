import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (iso: string) => void
  lang: string
  id?: string
  ariaLabel?: string
  variant?: 'cream' | 'input'
  size?: 'md' | 'sm'
}

function localeFor(lang: string) {
  return lang === 'el' ? 'el-GR' : 'en-GB'
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toIso(year: number, monthIndex: number, day: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`
}

function parseIso(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2]) - 1
  const d = Number(match[3])
  const dt = new Date(y, m, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null
  return { y, m, d }
}

function weekdayLabels(locale: string) {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(2024, 0, 1 + i)).replace('.', ''),
  )
}

export function HmDateField({ value, onChange, lang, id, ariaLabel, variant = 'input', size = 'md' }: Props) {
  const isEl = lang === 'el'
  const locale = localeFor(lang)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = parseIso(value)
  const today = new Date()
  const [view, setView] = useState(() => ({
    y: selected?.y ?? today.getFullYear(),
    m: selected?.m ?? today.getMonth(),
  }))

  useEffect(() => {
    if (!open) return
    setView({
      y: selected?.y ?? today.getFullYear(),
      m: selected?.m ?? today.getMonth(),
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const dows = useMemo(() => weekdayLabels(locale), [locale])
  const monthTitle = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(view.y, view.m, 1)),
    [locale, view.y, view.m],
  )

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1)
    const startOffset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
    const prevDays = new Date(view.y, view.m, 0).getDate()
    const items: { day: number; iso: string; muted: boolean }[] = []
    for (let i = 0; i < startOffset; i++) {
      const day = prevDays - startOffset + 1 + i
      const dt = new Date(view.y, view.m - 1, day)
      items.push({ day, iso: toIso(dt.getFullYear(), dt.getMonth(), day), muted: true })
    }
    for (let day = 1; day <= daysInMonth; day++) {
      items.push({ day, iso: toIso(view.y, view.m, day), muted: false })
    }
    while (items.length % 7) {
      const day = items.length - startOffset - daysInMonth + 1
      const dt = new Date(view.y, view.m + 1, day)
      items.push({ day, iso: toIso(dt.getFullYear(), dt.getMonth(), day), muted: true })
    }
    return items
  }, [view.y, view.m])

  const display = selected
    ? `${pad(selected.d)} / ${pad(selected.m + 1)} / ${selected.y}`
    : isEl
      ? 'ηη / μμ / εεεε'
      : 'dd / mm / yyyy'

  const shiftMonth = (delta: number) => {
    setView((cur) => {
      const dt = new Date(cur.y, cur.m + delta, 1)
      return { y: dt.getFullYear(), m: dt.getMonth() }
    })
  }

  return (
    <div className={`hm-date-field hm-date-field--${variant}${size === 'sm' ? ' hm-date-field--sm' : ''}`} ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="hm-date-field__trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`hm-date-field__value${value ? '' : ' is-placeholder'}`}>{display}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div className="hm-date-cal" role="dialog" aria-label={ariaLabel}>
          <div className="hm-date-cal__nav">
            <button type="button" className="hm-date-cal__nav-btn" onClick={() => shiftMonth(-1)} aria-label={isEl ? 'Προηγούμενος μήνας' : 'Previous month'}>
              ‹
            </button>
            <div className="hm-date-cal__month">{monthTitle}</div>
            <button type="button" className="hm-date-cal__nav-btn" onClick={() => shiftMonth(1)} aria-label={isEl ? 'Επόμενος μήνας' : 'Next month'}>
              ›
            </button>
          </div>
          <div className="hm-date-cal__grid">
            {dows.map((d) => (
              <span key={d} className="hm-date-cal__dow">{d}</span>
            ))}
            {cells.map((cell) => (
              <button
                key={cell.iso}
                type="button"
                className={`hm-date-cal__day${cell.muted ? ' is-muted' : ''}${cell.iso === value ? ' is-selected' : ''}${cell.iso === toIso(today.getFullYear(), today.getMonth(), today.getDate()) ? ' is-today' : ''}`}
                onClick={() => {
                  onChange(cell.iso)
                  setOpen(false)
                }}
              >
                {cell.day}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
