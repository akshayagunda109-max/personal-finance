import { useEffect, useMemo, useState } from 'react'
import type { Account, Transaction } from '../api'
import {
  getCategoryInsight,
  listAccounts,
  listTransactions,
  updateTransactionCategory,
} from '../api'
import { ALL_CATEGORIES, categoryColorVar } from '../categoryColors'
import { CategoryBarChart } from '../charts/CategoryBarChart'
import { MonthlyTrendChart } from '../charts/MonthlyTrendChart'

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Direction = 'all' | 'credit' | 'debit'

type Filters = {
  dateFrom: string
  dateTo: string
  direction: Direction
  category: string // 'all' or a specific category
}

const DEFAULT_FILTERS: Filters = { dateFrom: '', dateTo: '', direction: 'all', category: 'all' }

function matchesFilters(t: Transaction, filters: Filters): boolean {
  if (filters.dateFrom && t.date < filters.dateFrom) return false
  if (filters.dateTo && t.date > filters.dateTo) return false
  const amount = Number(t.amount)
  if (filters.direction === 'credit' && amount <= 0) return false
  if (filters.direction === 'debit' && amount >= 0) return false
  if (filters.category !== 'all' && t.category !== filters.category) return false
  return true
}

type Props = {
  initialAccountId?: number | null
}

export function Dashboard({ initialAccountId }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  const [insight, setInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [addingCategoryFor, setAddingCategoryFor] = useState<number | null>(null)
  const [newCategoryDraft, setNewCategoryDraft] = useState('')

  useEffect(() => {
    listAccounts().then((accs) => {
      setAccounts(accs)
      if (initialAccountId != null) {
        setAccountId(initialAccountId)
      } else if (accs.length > 0) {
        setAccountId(accs[0].id)
      }
    }).catch((e: Error) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (initialAccountId != null) setAccountId(initialAccountId)
  }, [initialAccountId])

  useEffect(() => {
    if (accountId === null) return
    setLoading(true)
    setError(null)
    setFilters(DEFAULT_FILTERS)
    listTransactions(accountId)
      .then(setTransactions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId])

  // The AI summary is tied to whichever single category is selected - it
  // reflects that category's full history, not the date/direction filters.
  useEffect(() => {
    if (accountId === null || filters.category === 'all') {
      setInsight(null)
      setInsightError(null)
      return
    }
    setInsightLoading(true)
    setInsightError(null)
    getCategoryInsight(accountId, filters.category)
      .then((res) => setInsight(res.summary))
      .catch((e: Error) => setInsightError(e.message))
      .finally(() => setInsightLoading(false))
  }, [accountId, filters.category])

  async function handleCategoryChange(txn: Transaction, newCategory: string) {
    if (newCategory === txn.category) return
    setSavingId(txn.id)
    setError(null)
    try {
      const updated = await updateTransactionCategory(txn.id, newCategory)
      setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingId(null)
    }
  }

  function startNewCategory(txnId: number) {
    setAddingCategoryFor(txnId)
    setNewCategoryDraft('')
  }

  function cancelNewCategory() {
    setAddingCategoryFor(null)
    setNewCategoryDraft('')
  }

  async function confirmNewCategory(txn: Transaction) {
    const name = newCategoryDraft.trim()
    setAddingCategoryFor(null)
    if (!name) return
    await handleCategoryChange(txn, name)
    setNewCategoryDraft('')
  }

  const filteredTransactions = useMemo(
    () => transactions.filter((t) => matchesFilters(t, filters)),
    [transactions, filters],
  )

  const totalIncome = filteredTransactions.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0)
  const totalSpend = filteredTransactions.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const net = totalIncome - totalSpend

  const barData = useMemo(() => {
    const byCategory = new Map<string, { count: number; amount: number }>()
    for (const t of filteredTransactions) {
      if (!t.category) continue
      const entry = byCategory.get(t.category) ?? { count: 0, amount: 0 }
      entry.count += 1
      entry.amount += Number(t.amount)
      byCategory.set(t.category, entry)
    }
    return Array.from(byCategory.entries()).map(([category, { count, amount }]) => ({ category, count, amount }))
  }, [filteredTransactions])

  const monthlyData = useMemo(() => {
    const byMonth = new Map<string, number>()
    for (const t of filteredTransactions) {
      const amount = Number(t.amount)
      if (amount >= 0) continue
      const month = t.date.slice(0, 7)
      byMonth.set(month, (byMonth.get(month) ?? 0) + Math.abs(amount))
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, spend]) => ({ month, spend }))
  }, [filteredTransactions])

  // Built-in categories first, then any custom ones already used in this account.
  const dropdownCategories = useMemo(() => {
    const used = Array.from(new Set(transactions.map((t) => t.category).filter((c): c is string => !!c)))
    return [...ALL_CATEGORIES, ...used.filter((c) => !ALL_CATEGORIES.includes(c))]
  }, [transactions])

  const currency = accounts.find((a) => a.id === accountId)?.currency ?? ''
  const filtersActive = filters.dateFrom || filters.dateTo || filters.direction !== 'all' || filters.category !== 'all'

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Dashboard</h2>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="form-field" style={{ maxWidth: 280 }}>
          <label htmlFor="dash-account">Account</label>
          <select
            id="dash-account"
            className="select"
            value={accountId ?? ''}
            onChange={(e) => setAccountId(Number(e.target.value) || null)}
          >
            {accounts.length === 0 && <option value="">No accounts yet</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </select>
        </div>

        <div className="form-row section-gap">
          <div className="form-field">
            <label htmlFor="filter-date-from">From</label>
            <input
              id="filter-date-from"
              type="date"
              className="input"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="filter-date-to">To</label>
            <input
              id="filter-date-to"
              type="date"
              className="input"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="filter-direction">Type</label>
            <select
              id="filter-direction"
              className="select"
              value={filters.direction}
              onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value as Direction }))}
            >
              <option value="all">All</option>
              <option value="credit">Credit (money in)</option>
              <option value="debit">Debit (money out)</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filter-category">Category</label>
            <select
              id="filter-category"
              className="select"
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="all">All categories</option>
              {dropdownCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {filtersActive && (
            <button className="btn btn-secondary btn-sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="inline-loading" style={{ marginBottom: '1rem' }}>
          <span className="spinner" />
          Loading account data...
        </div>
      )}

      {!loading && accountId !== null && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-value">{filteredTransactions.length}</div>
              <div className="stat-label">Transactions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--success)' }}>+{formatMoney(totalIncome)}</div>
              <div className="stat-label">Total income ({currency})</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--danger)' }}>−{formatMoney(totalSpend)}</div>
              <div className="stat-label">Total spend ({currency})</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {net >= 0 ? '+' : '−'}{formatMoney(Math.abs(net))}
              </div>
              <div className="stat-label">Net ({currency})</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Monthly spend</div>
            <MonthlyTrendChart data={monthlyData} />
          </div>

          <div className="card">
            <div className="card-title">Spending by category</div>
            {barData.length === 0 ? (
              <p className="muted">No categorized transactions match the current filters.</p>
            ) : (
              <>
                <CategoryBarChart
                  data={barData}
                  selected={filters.category === 'all' ? null : filters.category}
                  onSelect={(category) => setFilters((f) => ({ ...f, category }))}
                />
                <p className="field-hint">Click a category to filter the table below and see an AI summary.</p>
              </>
            )}
          </div>

          <div className="card">
            {filters.category !== 'all' ? (
              <>
                <div className="card-title">
                  <span className="category-dot" style={{ background: categoryColorVar(filters.category), marginRight: '0.5rem' }} />
                  {filters.category}
                </div>

                {insightLoading && (
                  <div className="inline-loading" style={{ marginBottom: '0.75rem' }}>
                    <span className="spinner" />
                    Generating summary...
                  </div>
                )}
                {insightError && <div className="alert alert-error">{insightError}</div>}
                {insight && <p className="insight-box">{insight}</p>}
              </>
            ) : (
              <div className="card-title">Transactions</div>
            )}

            <p className="field-hint section-gap">
              Recheck each transaction below - if a category looks wrong, change it in the dropdown.
            </p>
            {filteredTransactions.length === 0 ? (
              <p className="muted">No transactions match the current filters.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Transaction</th>
                      <th>Amount</th>
                      <th>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((t) => (
                      <tr key={t.id}>
                        <td>{t.date}</td>
                        <td title={t.description}>{t.display_name ?? t.description}</td>
                        <td className={Number(t.amount) > 0 ? 'positive' : Number(t.amount) < 0 ? 'negative' : ''}>
                          {formatMoney(Number(t.amount))}
                        </td>
                        <td>
                          {addingCategoryFor === t.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input
                                className="input"
                                autoFocus
                                placeholder="New category name"
                                value={newCategoryDraft}
                                onChange={(e) => setNewCategoryDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') confirmNewCategory(t)
                                  if (e.key === 'Escape') cancelNewCategory()
                                }}
                              />
                              <button className="btn btn-primary btn-sm" onClick={() => confirmNewCategory(t)}>Add</button>
                              <button className="btn btn-secondary btn-sm" onClick={cancelNewCategory}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <select
                                className="select"
                                value={t.category ?? ''}
                                disabled={savingId === t.id}
                                onChange={(e) => {
                                  if (e.target.value === '__new__') {
                                    startNewCategory(t.id)
                                  } else {
                                    handleCategoryChange(t, e.target.value)
                                  }
                                }}
                              >
                                {dropdownCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                                <option value="__new__">+ Add new category...</option>
                              </select>
                              {savingId === t.id && <span className="spinner" />}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!loading && accountId === null && (
        <p className="muted">No accounts yet - upload a statement first to create one.</p>
      )}
    </div>
  )
}
