type SeriesPoint = { date: string; value: number }

const W = 560
const H = 180
const PAD = { top: 14, right: 14, bottom: 28, left: 44 }

function formatShortDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTick(n: number, money?: boolean) {
  if (money) {
    if (n >= 100) return n.toFixed(0)
    if (n >= 10) return n.toFixed(1)
    return n.toFixed(2)
  }
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

export function SeriesChart({
  series,
  label,
  color = '#4ABEAA',
  money = false,
  emptyText = 'No data in this window.',
}: {
  series: SeriesPoint[]
  label: string
  color?: string
  money?: boolean
  emptyText?: string
}) {
  const hasData = series.some((p) => p.value > 0)
  if (!series.length || !hasData) {
    return <div className="insights-chart-empty">{emptyText}</div>
  }

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const maxY = Math.max(...series.map((p) => p.value), 0.0001)
  const step = series.length > 1 ? plotW / (series.length - 1) : plotW

  const coords = series.map((p, i) => {
    const x = PAD.left + i * step
    const y = PAD.top + plotH - (p.value / maxY) * plotH
    return { x, y, ...p }
  })

  const linePath = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`
  const yTicks = [0, maxY / 2, maxY]
  const xLabels = [
    { label: formatShortDate(series[0].date), x: coords[0].x },
    {
      label: formatShortDate(series[series.length - 1].date),
      x: coords[coords.length - 1].x,
    },
  ]

  return (
    <div className="insights-chart-wrap">
      <svg className="insights-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {yTicks.map((tick) => {
          const y = PAD.top + plotH - (tick / maxY) * plotH
          return (
            <g key={tick}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} className="insights-chart-grid" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" className="insights-chart-axis">
                {formatTick(tick, money)}
              </text>
            </g>
          )
        })}
        <path d={areaPath} fill={color} opacity={0.12} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {xLabels.map((item, i) => (
          <text
            key={i}
            x={item.x}
            y={H - 8}
            textAnchor={i === 0 ? 'start' : 'end'}
            className="insights-chart-axis"
          >
            {item.label}
          </text>
        ))}
      </svg>
    </div>
  )
}

export function BarChart({
  items,
  label,
  color = '#2B3A67',
  emptyText = 'No data yet.',
  valueSuffix = '',
}: {
  items: { label: string; value: number; hint?: string }[]
  label: string
  color?: string
  emptyText?: string
  valueSuffix?: string
}) {
  const max = Math.max(...items.map((i) => i.value), 0)
  if (!items.length || max <= 0) {
    return <div className="insights-chart-empty">{emptyText}</div>
  }

  return (
    <div className="insights-bars" role="img" aria-label={label}>
      {items.map((item) => {
        const pct = Math.max(2, (item.value / max) * 100)
        return (
          <div className="insights-bar-row" key={item.label}>
            <div className="insights-bar-label">
              <span>{item.label}</span>
              {item.hint ? <span className="meta">{item.hint}</span> : null}
            </div>
            <div className="insights-bar-track">
              <div className="insights-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className="insights-bar-value">
              {item.value}
              {valueSuffix}
            </div>
          </div>
        )
      })}
    </div>
  )
}
