import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (iso: string) => void
  lang: string
  id?: string
  ariaLabel?: string
  variant?: 'cream' | 'input'
  size?: 'md' | 'sm'
  min?: string
  max?: string
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

function monthLabels(locale: string) {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short' })
  return Array.from({ length: 12 }, (_, i) =>
    fmt.format(new Date(2024, i, 1)).replace('.', ''),
  )
}

function yearOptions(extra: number[], bounds?: { min?: string; max?: string }) {
  const nowY = new Date().getFullYear()
  const minBound = bounds?.min ? parseIso(bounds.min)?.y : undefined
  const maxBound = bounds?.max ? parseIso(bounds.max)?.y : undefined
  const max = Math.max(maxBound ?? nowY + 2, ...extra)
  const min = Math.min(minBound ?? nowY - 80, ...extra)
  const years: number[] = []
  for (let y = max; y >= min; y -= 1) years.push(y)
  return years
}

function isOutOfRange(iso: string, min?: string, max?: string) {
  if (min && iso < min) return true
  if (max && iso > max) return true
  return false
}

function calendarBox(el: HTMLElement, size: 'md' | 'sm') {
  const r = el.getBoundingClientRect()
  const calW = size === 'sm' ? 248 : 268
  const calH = size === 'sm' ? 228 : 252
  const gap = 6
  const spaceBelow = window.innerHeight - r.bottom - gap
  const openUp = spaceBelow < calH && r.top > spaceBelow
  const top = openUp ? Math.max(8, r.top - calH - gap) : r.bottom + gap
  let left = r.left
  if (left + calW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - calW - 8)
  return { top, left, width: Math.min(calW, r.width) }
}

export function HmDateField({ value, onChange, lang, id, ariaLabel, variant = 'input', size = 'md', min, max }: Props) {
  const isEl = lang === 'el'
  const locale = localeFor(lang)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [calPos, setCalPos] = useState<{ top: number; left: number; width: number } | null>(null)
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
    const place = () => {
      const el = wrapRef.current
      if (!el) return
      setCalPos(calendarBox(el, size))
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, size, view.y, view.m])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (wrapRef.current?.contains(target)) return
      // Native <select> menus can render options outside the calendar.
      if (target.tagName === 'OPTION' || target.tagName === 'SELECT') return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const dows = useMemo(() => weekdayLabels(locale), [locale])
  const months = useMemo(() => monthLabels(locale), [locale])
  const years = useMemo(
    () => yearOptions([selected?.y ?? today.getFullYear(), view.y], { min, max }),
    [selected?.y, view.y, min, max],
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
        onClick={() => {
          if (open) {
            setOpen(false)
            return
          }
          if (wrapRef.current) setCalPos(calendarBox(wrapRef.current, size))
          setOpen(true)
        }}
      >
        <span className={`hm-date-field__value${value ? '' : ' is-placeholder'}`}>{display}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          className="hm-date-cal"
          role="dialog"
          aria-label={ariaLabel}
          style={calPos ? { top: calPos.top, left: calPos.left, width: calPos.width } : undefined}
        >
          <div className="hm-date-cal__nav">
            <button type="button" className="hm-date-cal__nav-btn" onClick={() => shiftMonth(-1)} aria-label={isEl ? 'Προηγούμενος μήνας' : 'Previous month'}>
              ‹
            </button>
            <div className="hm-date-cal__selects">
              <select
                className="hm-date-cal__select hm-date-cal__select--month"
                value={view.m}
                aria-label={isEl ? 'Μήνας' : 'Month'}
                onChange={(e) => setView((cur) => ({ ...cur, m: Number(e.target.value) }))}
              >
                {months.map((label, i) => (
                  <option key={label} value={i}>{label}</option>
                ))}
              </select>
              <select
                className="hm-date-cal__select hm-date-cal__select--year"
                value={view.y}
                aria-label={isEl ? 'Έτος' : 'Year'}
                onChange={(e) => setView((cur) => ({ ...cur, y: Number(e.target.value) }))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button type="button" className="hm-date-cal__nav-btn" onClick={() => shiftMonth(1)} aria-label={isEl ? 'Επόμενος μήνας' : 'Next month'}>
              ›
            </button>
          </div>
          <div className="hm-date-cal__grid">
            {dows.map((d) => (
              <span key={d} className="hm-date-cal__dow">{d}</span>
            ))}
            {cells.map((cell, idx) => {
              const disabled = isOutOfRange(cell.iso, min, max)
              return (
              <button
                key={`${cell.iso}-${idx}`}
                type="button"
                disabled={disabled}
                className={`hm-date-cal__day${cell.muted ? ' is-muted' : ''}${disabled ? ' is-disabled' : ''}${cell.iso === value ? ' is-selected' : ''}${cell.iso === toIso(today.getFullYear(), today.getMonth(), today.getDate()) ? ' is-today' : ''}`}
                onClick={() => {
                  if (disabled) return
                  onChange(cell.iso)
                  setOpen(false)
                }}
              >
                {cell.day}
              </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
