import { categoryColorVar } from '../categoryColors'

export type CategoryBarDatum = {
  category: string
  count: number
  amount: number
}

type Props = {
  data: CategoryBarDatum[]
  selected?: string | null
  onSelect: (category: string) => void
}

function formatAmount(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Horizontal bar chart, one bar per category - categorical color (identity
// matters here: the reader clicks a bar to drill into that category).
// Direct labels (count + signed amount) mean nothing is hover-only.
export function CategoryBarChart({ data, selected, onSelect }: Props) {
  const sorted = [...data].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  const max = Math.max(...sorted.map((d) => Math.abs(d.amount)), 1)

  return (
    <div className="bar-chart" role="list">
      {sorted.map((d) => {
        const pct = (Math.abs(d.amount) / max) * 100
        const isSelected = selected === d.category
        return (
          <div
            key={d.category}
            role="listitem button"
            tabIndex={0}
            className={`bar-row ${isSelected ? 'bar-row-selected' : ''}`}
            onClick={() => onSelect(d.category)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(d.category)
              }
            }}
          >
            <span className="bar-label" title={d.category}>{d.category}</span>
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{ width: `${pct}%`, background: categoryColorVar(d.category) }}
              />
            </span>
            <span className="bar-count">{d.count} txn{d.count === 1 ? '' : 's'}</span>
            <span className={`bar-amount ${d.amount > 0 ? 'positive' : d.amount < 0 ? 'negative' : ''}`}>
              {formatAmount(d.amount)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
