import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { FieldLabel } from './ui'
import { useAdmin } from '../context/AdminContext'

export type PickerUser = {
  id: string
  email?: string
  name?: string
  plan?: string
  subscription_status?: string
}

type Props = {
  picked: PickerUser[]
  onChange: (next: PickerUser[]) => void
  label?: string
}

function labelOf(u: PickerUser) {
  return (u.name || 'No name') + ' · ' + (u.email || 'no email')
}

export function PeoplePicker({ picked, onChange, label = 'Select people' }: Props) {
  const { adminFetch } = useAdmin()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PickerUser[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const pickedIds = useMemo(() => new Set(picked.map((u) => u.id)), [picked])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    setLoading(true)
    const handle = window.setTimeout(() => {
      const path =
        q.length >= 1
          ? `/admin/notifications/users?q=${encodeURIComponent(q)}`
          : '/admin/notifications/users'
      void adminFetch(path)
        .then((d) => setHits((d.users as PickerUser[]) || []))
        .catch(() => setHits([]))
        .finally(() => setLoading(false))
    }, q ? 200 : 0)
    return () => window.clearTimeout(handle)
  }, [query, open, adminFetch])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (u: PickerUser) => {
    if (pickedIds.has(u.id)) {
      onChange(picked.filter((x) => x.id !== u.id))
      return
    }
    onChange([...picked, u])
  }

  const options = useMemo(() => {
    const list = hits.filter((u) => u.id)
    return [...list].sort((a, b) => {
      const aOn = pickedIds.has(a.id) ? 0 : 1
      const bOn = pickedIds.has(b.id) ? 0 : 1
      if (aOn !== bOn) return aOn - bOn
      return labelOf(a).localeCompare(labelOf(b), undefined, { sensitivity: 'base' })
    })
  }, [hits, pickedIds])

  return (
    <div className="field-wrap people-picker" ref={rootRef}>
      <FieldLabel>{label}</FieldLabel>
      {picked.length > 0 ? (
        <div className="people-picker__chips" aria-label="Selected people">
          {picked.map((u) => (
            <button
              key={u.id}
              type="button"
              className="people-picker__chip"
              onClick={() => onChange(picked.filter((x) => x.id !== u.id))}
              title="Remove"
            >
              <span>{u.name || u.email || u.id}</span>
              <X size={12} aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="ghost sm people-picker__clear" onClick={() => onChange([])}>
            Clear all
          </button>
        </div>
      ) : null}

      <div className="people-picker__control-wrap">
        <div className={`people-picker__control${open ? ' is-open' : ''}`}>
          <Search size={15} className="people-picker__icon" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder="Type to search, or open the list…"
            aria-expanded={open}
            aria-controls={listId}
            autoComplete="off"
          />
          <button
            type="button"
            className="people-picker__toggle"
            aria-label={open ? 'Close list' : 'Open list'}
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {open ? (
          <div className="people-picker__menu" id={listId} role="listbox" aria-multiselectable="true">
            {loading ? <p className="people-picker__empty">Loading people…</p> : null}
            {!loading && options.length === 0 ? (
              <p className="people-picker__empty">
                {query.trim() ? 'No matches' : 'No people found'}
              </p>
            ) : null}
            {!loading
              ? options.map((u) => {
                  const on = pickedIds.has(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      role="option"
                      aria-selected={on}
                      className={`people-picker__option${on ? ' is-on' : ''}`}
                      onClick={() => toggle(u)}
                    >
                      <span className="people-picker__option-main">{labelOf(u)}</span>
                      <span className="people-picker__option-meta">
                        {[u.subscription_status, u.plan].filter(Boolean).join(' · ') || '—'}
                      </span>
                      <span className="people-picker__check" aria-hidden="true">
                        {on ? <Check size={14} strokeWidth={3} /> : null}
                      </span>
                    </button>
                  )
                })
              : null}
          </div>
        ) : null}
      </div>
      <p className="people-picker__hint">
        {picked.length === 0
          ? 'Open the list and click people to add them. You can select more than one.'
          : `${picked.length} selected — click again to remove`}
      </p>
    </div>
  )
}
