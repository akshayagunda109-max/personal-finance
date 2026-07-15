import { useEffect, useState } from 'react'
import type { Account, CategorySummaryResponse, MonthlySummaryResponse, Transaction } from '../api'
import {
  getCategoryInsight,
  getCategorySummary,
  getMonthlySummary,
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

type Props = {
  initialAccountId?: number | null
}

export function Dashboard({ initialAccountId }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<CategorySummaryResponse | null>(null)
  const [monthly, setMonthly] = useState<MonthlySummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryTxns, setCategoryTxns] = useState<Transaction[]>([])
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
    setSelectedCategory(null)
    Promise.all([
      listTransactions(accountId),
      getCategorySummary(accountId),
      getMonthlySummary(accountId),
    ])
      .then(([txns, catSummary, monthlySummary]) => {
        setTransactions(txns)
        setSummary(catSummary)
        setMonthly(monthlySummary)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId])

  function selectCategory(category: string) {
    if (accountId === null) return
    setSelectedCategory(category)
    setInsight(null)
    setInsightError(null)
    listTransactions(accountId, category).then(setCategoryTxns).catch((e: Error) => setError(e.message))

    setInsightLoading(true)
    getCategoryInsight(accountId, category)
      .then((res) => setInsight(res.summary))
      .catch((e: Error) => setInsightError(e.message))
      .finally(() => setInsightLoading(false))
  }

  async function handleCategoryChange(txn: Transaction, newCategory: string) {
    if (accountId === null || newCategory === txn.category) return
    setSavingId(txn.id)
    setError(null)
    try {
      await updateTransactionCategory(txn.id, newCategory)
      const [catSummary, updatedList] = await Promise.all([
        getCategorySummary(accountId),
        listTransactions(accountId, selectedCategory ?? undefined),
      ])
      setSummary(catSummary)
      setCategoryTxns(updatedList)
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

  const totalIncome = transactions.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0)
  const totalSpend = transactions.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const net = totalIncome - totalSpend

  const barData = summary
    ? Object.entries(summary.breakdown).map(([category, entry]) => ({
      category,
      count: entry.count,
      amount: Number(entry.total_amount),
    }))
    : []

  const monthlyData = monthly
    ? monthly.months.map((m) => ({ month: m.month, spend: Number(m.total_spend) }))
    : []

  // Built-in categories first, then any custom ones already used in this
  // account that aren't already in the built-in set.
  const dropdownCategories = [
    ...ALL_CATEGORIES,
    ...Object.keys(summary?.breakdown ?? {}).filter((c) => !ALL_CATEGORIES.includes(c)),
  ]

  const currency = accounts.find((a) => a.id === accountId)?.currency ?? ''

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
              <div className="stat-value">{transactions.length}</div>
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
              <p className="muted">No categorized transactions yet.</p>
            ) : (
              <>
                <CategoryBarChart data={barData} selected={selectedCategory} onSelect={selectCategory} />
                <p className="field-hint">Click a category to see its transactions and an AI summary.</p>
              </>
            )}
          </div>

          {selectedCategory && (
            <div className="card">
              <div className="card-title">
                <span className="category-dot" style={{ background: categoryColorVar(selectedCategory), marginRight: '0.5rem' }} />
                {selectedCategory}
              </div>

              {insightLoading && (
                <div className="inline-loading" style={{ marginBottom: '0.75rem' }}>
                  <span className="spinner" />
                  Generating summary...
                </div>
              )}
              {insightError && <div className="alert alert-error">{insightError}</div>}
              {insight && <p className="insight-box">{insight}</p>}

              <p className="field-hint section-gap">
                Recheck each transaction below - if a category looks wrong, change it in the dropdown.
              </p>
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
                    {categoryTxns.map((t) => (
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
            </div>
          )}
        </>
      )}

      {!loading && accountId === null && (
        <p className="muted">No accounts yet - upload a statement first to create one.</p>
      )}
    </div>
  )
}
