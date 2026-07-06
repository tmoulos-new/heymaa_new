/** Format a stored timestamp for `<input type="datetime-local" />` (local timezone). */
export function datetimeLocalInputValue(v?: string | null): string {
  if (!v) return ''
  const s = v.trim()
  // Postgres date or timestamptz serialized as date-only (e.g. 2026-07-07)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s}T00:00`
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Format a stored timestamp for display in lists and tables. */
export function formatWhen(v?: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleString()
}
