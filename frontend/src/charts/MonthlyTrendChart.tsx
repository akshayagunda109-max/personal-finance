import { useMemo, useState } from 'react'

export type MonthlyDatum = {
  month: string // YYYY-MM
  spend: number
}

type Props = {
  data: MonthlyDatum[]
}

const WIDTH = 640
const HEIGHT = 220
const PAD_LEFT = 48
const PAD_RIGHT = 16
const PAD_TOP = 16
const PAD_BOTTOM = 28

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

// Single-series trend over time - sequential (one hue) line, per dataviz
// guidance: "trend over time -> line ... sequential or 1 categorical".
export function MonthlyTrendChart({ data }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const { points, yMax, plotW, plotH } = useMemo(() => {
    const plotW = WIDTH - PAD_LEFT - PAD_RIGHT
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM
    const yMax = niceMax(Math.max(...data.map((d) => d.spend), 0))
    const points = data.map((d, i) => {
      const x = data.length === 1 ? PAD_LEFT + plotW / 2 : PAD_LEFT + (i / (data.length - 1)) * plotW
      const y = PAD_TOP + plotH - (yMax === 0 ? 0 : (d.spend / yMax) * plotH)
      return { x, y, ...d }
    })
    return { points, yMax, plotW, plotH }
  }, [data])

  if (data.length === 0) {
    return <p className="muted">Not enough data for a trend yet.</p>
  }

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const gridLines = [0, 0.5, 1].map((f) => PAD_TOP + plotH - f * plotH)
  const hovered = hoverIdx !== null ? points[hoverIdx] : null

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH
    let nearest = 0
    let nearestDist = Infinity
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = i
      }
    })
    setHoverIdx(nearest)
  }

  return (
    <div className="trend-chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="trend-chart"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIdx(null)}
      >
        {gridLines.map((y, i) => (
          <line key={i} x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} className="trend-grid" />
        ))}
        <text x={PAD_LEFT - 8} y={gridLines[2] + 4} textAnchor="end" className="trend-axis-label">0</text>
        <text x={PAD_LEFT - 8} y={gridLines[0] + 4} textAnchor="end" className="trend-axis-label">
          {yMax.toLocaleString()}
        </text>

        {hovered && (
          <line
            x1={hovered.x} x2={hovered.x}
            y1={PAD_TOP} y2={PAD_TOP + plotH}
            className="trend-crosshair"
          />
        )}

        <path d={linePath} className="trend-line" fill="none" />

        {points.map((p, i) => (
          <g key={p.month}>
            <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={4} className="trend-dot" />
            {i === points.length - 1 && (
              <text x={p.x} y={p.y - 12} textAnchor="end" className="trend-end-label">
                {p.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </text>
            )}
          </g>
        ))}

        {points.map((p, i) => {
          if (points.length > 8 && i % 2 !== 0 && i !== points.length - 1) return null
          return (
            <text key={p.month} x={p.x} y={HEIGHT - 8} textAnchor="middle" className="trend-axis-label">
              {monthLabel(p.month)}
            </text>
          )
        })}
      </svg>

      {hovered && (
        <div className="trend-tooltip" style={{ left: `${(hovered.x / WIDTH) * 100}%` }}>
          <strong>{hovered.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          <span>{monthLabel(hovered.month)}</span>
        </div>
      )}
    </div>
  )
}
