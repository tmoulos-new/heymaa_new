function formatLabel(key: string): string {
  return key.replace(/_/g, ' ')
}

function isIsoDateString(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(v)
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    if (isIsoDateString(value)) {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) return d.toLocaleString()
    }
    return value
  }
  return String(value)
}

function formatArrayValue(value: unknown[]): string {
  if (value.length === 0) return '—'
  if (value.every((v) => v === null || typeof v !== 'object')) {
    return value.map((v) => formatScalar(v)).join(', ')
  }
  return `${value.length} items`
}

type ValuePairsProps = {
  value?: Record<string, unknown> | null
  nested?: boolean
}

export function ValuePairs({ value, nested = false }: ValuePairsProps) {
  if (!value || Object.keys(value).length === 0) {
    return <span className="value-pairs-empty">—</span>
  }

  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b))

  return (
    <dl className={nested ? 'value-pairs value-pairs-nested' : 'value-pairs'}>
      {entries.map(([key, val]) => {
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
          return (
            <div key={key} className="value-pair value-pair-block">
              <dt className="value-pair-key">{formatLabel(key)}</dt>
              <dd className="value-pair-val">
                <ValuePairs value={val as Record<string, unknown>} nested />
              </dd>
            </div>
          )
        }

        if (Array.isArray(val)) {
          if (val.length === 0) {
            return (
              <div key={key} className="value-pair">
                <dt className="value-pair-key">{formatLabel(key)}</dt>
                <dd className="value-pair-val">—</dd>
              </div>
            )
          }
          if (val.every((v) => v !== null && typeof v === 'object' && !Array.isArray(v))) {
            return (
              <div key={key} className="value-pair value-pair-block">
                <dt className="value-pair-key">{formatLabel(key)}</dt>
                <dd className="value-pair-val">
                  {val.map((item, i) => (
                    <ValuePairs
                      key={i}
                      value={item as Record<string, unknown>}
                      nested
                    />
                  ))}
                </dd>
              </div>
            )
          }
        }

        const display = Array.isArray(val) ? formatArrayValue(val) : formatScalar(val)

        return (
          <div key={key} className="value-pair">
            <dt className="value-pair-key">{formatLabel(key)}</dt>
            <dd className="value-pair-val">{display}</dd>
          </div>
        )
      })}
    </dl>
  )
}
