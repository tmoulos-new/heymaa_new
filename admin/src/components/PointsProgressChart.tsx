import type { PointTimelineEntry } from '../lib/types'

const W = 520
const H = 180
const PAD = { top: 12, right: 12, bottom: 28, left: 40 }

function formatShortDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function PointsProgressChart({ timeline }: { timeline: PointTimelineEntry[] }) {
  if (!timeline.length) {
    return (
      <div className="points-chart-empty">
        No point activity yet — progress will appear here as the user earns points.
      </div>
    )
  }

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const maxY = Math.max(...timeline.map((p) => p.cumulative), 1)
  const minT = new Date(timeline[0].at || Date.now()).getTime()
  const maxT = new Date(timeline[timeline.length - 1].at || Date.now()).getTime()
  const spanT = Math.max(maxT - minT, 1)

  const coords = timeline.map((p) => {
    const t = new Date(p.at || Date.now()).getTime()
    const x = PAD.left + ((t - minT) / spanT) * plotW
    const y = PAD.top + plotH - (p.cumulative / maxY) * plotH
    return { x, y, ...p }
  })

  const linePath = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`

  const yTicks = [0, Math.round(maxY / 2), maxY]
  const xLabels = [
    { label: formatShortDate(timeline[0].at), x: coords[0].x },
    {
      label: formatShortDate(timeline[timeline.length - 1].at),
      x: coords[coords.length - 1].x,
    },
  ]

  return (
    <div className="points-chart-wrap">
      <svg
        className="points-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Cumulative points over time"
      >
        {yTicks.map((tick) => {
          const y = PAD.top + plotH - (tick / maxY) * plotH
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                className="points-chart-grid"
              />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" className="points-chart-axis">
                {tick}
              </text>
            </g>
          )
        })}
        <path d={areaPath} className="points-chart-area" />
        <path d={linePath} className="points-chart-line" fill="none" />
        {coords.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={timeline.length > 40 ? 2 : 3.5} className="points-chart-dot" />
        ))}
        {xLabels.map((item, i) => (
          <text
            key={i}
            x={item.x}
            y={H - 6}
            textAnchor={i === 0 ? 'start' : 'end'}
            className="points-chart-axis"
          >
            {item.label}
          </text>
        ))}
      </svg>
    </div>
  )
}
