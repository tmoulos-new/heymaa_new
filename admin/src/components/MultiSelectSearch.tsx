import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

export type MultiSelectOption = {
  value: string
  label: string
  hint?: string
}

type Props = {
  options: MultiSelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
}

export function MultiSelectSearch({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  emptyLabel = 'No matches',
  disabled = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(
    () => options.filter((o) => value.includes(o.value)),
    [options, value],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.hint || '').toLowerCase().includes(q),
    )
  }, [options, query])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else onChange([...value, id])
  }

  return (
    <div className={`ms-wrap${disabled ? ' disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`ms-trigger${open ? ' open' : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        <span className="ms-trigger-text">
          {selected.length === 0 ? (
            <span className="ms-placeholder">Select…</span>
          ) : (
            selected.map((s) => (
              <span className="ms-chip" key={s.value}>
                {s.label}
                <span
                  className="ms-chip-x"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(s.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      toggle(s.value)
                    }
                  }}
                >
                  <X size={12} />
                </span>
              </span>
            ))
          )}
        </span>
        <ChevronDown size={16} className="ms-chevron" />
      </button>

      {open && (
        <div className="ms-panel">
          <input
            className="ms-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
          <div className="ms-list">
            {filtered.length === 0 && <div className="ms-empty">{emptyLabel}</div>}
            {filtered.map((o) => {
              const checked = value.includes(o.value)
              return (
                <label key={o.value} className={`ms-item${checked ? ' checked' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(o.value)} />
                  <span className="ms-item-label">
                    <span>{o.label}</span>
                    {o.hint ? <span className="ms-item-hint">{o.hint}</span> : null}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
