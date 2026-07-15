import { Fragment, useEffect, useRef, useState } from 'react'
import type { Account, CategorySummaryResponse, ColumnMapping, FilePreview, ImportResponse } from '../api'
import {
  categorizeTransactions,
  createAccount,
  getCategorySummary,
  importStatements,
  listAccounts,
  previewStatements,
} from '../api'
import { categoryColorVar } from '../categoryColors'

type Step = 'select-files' | 'review-mapping' | 'done'

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'select-files', label: 'Select files' },
  { key: 'review-mapping', label: 'Review mapping' },
  { key: 'done', label: 'Done' },
]

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'SGD']

function blankMapping(): ColumnMapping {
  return { date_column: '', description_column: '', amount_mode: 'single', amount_column: '' }
}

function formatAmount(value: string): string {
  const n = Number(value)
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}`
}

function StepIndicator({ step }: { step: Step }) {
  const currentIndex = STEP_LABELS.findIndex((s) => s.key === step)
  return (
    <div className="steps">
      {STEP_LABELS.map((s, i) => (
        <Fragment key={s.key}>
          <div className={`step ${i === currentIndex ? 'active' : ''} ${i < currentIndex ? 'done' : ''}`}>
            <span className="step-badge">{i < currentIndex ? '✓' : i + 1}</span>
            <span>{s.label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && <span className="step-connector" />}
        </Fragment>
      ))}
    </div>
  )
}

type Props = {
  onViewDashboard?: (accountId: number) => void
}

export function StatementUpload({ onViewDashboard }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState<number | null>(null)
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountCurrency, setNewAccountCurrency] = useState('USD')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [previews, setPreviews] = useState<FilePreview[]>([])
  const [mappings, setMappings] = useState<Record<string, ColumnMapping>>({})
  const [step, setStep] = useState<Step>('select-files')
  const [result, setResult] = useState<ImportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [categorizing, setCategorizing] = useState(false)
  const [newlyCategorized, setNewlyCategorized] = useState(0)
  const [summaryResult, setSummaryResult] = useState<CategorySummaryResponse | null>(null)
  const [categorizeError, setCategorizeError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listAccounts().then(setAccounts).catch((e: Error) => setError(e.message))
  }, [])

  async function handleCreateAccount() {
    if (!newAccountName.trim()) return
    setError(null)
    try {
      const account = await createAccount({
        name: newAccountName.trim(),
        currency: newAccountCurrency.trim().toUpperCase() || 'USD',
      })
      setAccounts((prev) => [...prev, account])
      setAccountId(account.id)
      setNewAccountName('')
      setShowNewAccount(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list)
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name))
      return [...prev, ...incoming.filter((f) => !existingNames.has(f.name))]
    })
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name))
  }

  async function handlePreview() {
    if (files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const res = await previewStatements(files)
      setPreviews(res.files)
      const initialMappings: Record<string, ColumnMapping> = {}
      for (const f of res.files) {
        if (f.suggested_mapping) initialMappings[f.filename] = f.suggested_mapping
      }
      setMappings(initialMappings)
      setStep('review-mapping')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function updateMapping(filename: string, patch: Partial<ColumnMapping>) {
    setMappings((prev) => ({
      ...prev,
      [filename]: { ...(prev[filename] ?? blankMapping()), ...patch },
    }))
  }

  async function handleImport() {
    if (accountId === null) return
    setBusy(true)
    setError(null)
    try {
      const payload = previews.map((f) => ({ filename: f.filename, mapping: mappings[f.filename] ?? blankMapping() }))
      const res = await importStatements(accountId, files, payload)
      setResult(res)
      setStep('done')

      setCategorizing(true)
      setCategorizeError(null)
      try {
        const catRes = await categorizeTransactions(accountId)
        setNewlyCategorized(catRes.categorized)
        // Always show the account's full category picture, not just what was
        // categorized in this run - otherwise a re-upload of an already-imported
        // statement (all duplicates, nothing new to categorize) shows nothing.
        const summary = await getCategorySummary(accountId)
        setSummaryResult(summary)
      } catch (e) {
        setCategorizeError((e as Error).message)
      } finally {
        setCategorizing(false)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setFiles([])
    setPreviews([])
    setMappings({})
    setResult(null)
    setNewlyCategorized(0)
    setSummaryResult(null)
    setCategorizeError(null)
    setStep('select-files')
  }

  const sortedBreakdown = summaryResult
    ? Object.entries(summaryResult.breakdown).sort((a, b) => b[1].count - a[1].count)
    : []

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Bulk statement upload</h2>
      <StepIndicator step={step} />
      {error && <div className="alert alert-error">{error}</div>}

      {step === 'select-files' && (
        <div className="card">
          <div className="card-title">Account</div>
          <div className="form-row" style={{ marginBottom: showNewAccount ? '1rem' : 0 }}>
            <div className="form-field">
              <label htmlFor="account-select">Import into</label>
              <select
                id="account-select"
                className="select"
                value={accountId ?? ''}
                onChange={(e) => setAccountId(Number(e.target.value) || null)}
              >
                <option value="">Select an account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                ))}
              </select>
            </div>
            <span className="divider-text">or</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNewAccount((v) => !v)}>
              {showNewAccount ? 'Cancel' : '+ New account'}
            </button>
          </div>

          {showNewAccount && (
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="new-account-name">Account name</label>
                <input
                  id="new-account-name"
                  className="input"
                  placeholder="e.g. HDFC Savings"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="new-account-currency">Currency</label>
                <select
                  id="new-account-currency"
                  className="select"
                  value={newAccountCurrency}
                  onChange={(e) => setNewAccountCurrency(e.target.value)}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleCreateAccount}>Create</button>
            </div>
          )}

          <div className="card-title section-gap">Statement files</div>
          <label
            className={`drop-zone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              addFiles(e.dataTransfer.files)
            }}
          >
            <div>Drag & drop CSV/XLSX files here, or click to browse</div>
            <div className="drop-zone-hint">Multiple files at once are supported</div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.xlsx,.xls"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </label>

          {files.length > 0 && (
            <ul className="file-chip-list">
              {files.map((f) => (
                <li key={f.name} className="file-chip">
                  {f.name}
                  <button type="button" onClick={() => removeFile(f.name)} aria-label={`Remove ${f.name}`}>×</button>
                </li>
              ))}
            </ul>
          )}

          <div className="section-gap">
            <button className="btn btn-primary" disabled={!accountId || files.length === 0 || busy} onClick={handlePreview}>
              {busy && <span className="spinner" />}
              {busy ? 'Reading files...' : 'Preview'}
            </button>
          </div>
        </div>
      )}

      {step === 'review-mapping' && (
        <div>
          {previews.map((f) => (
            <div key={f.filename} className="file-preview-card">
              <div className="file-preview-header">
                <span className="filename">{f.filename}</span>
                <span className="row-count">{f.row_count} rows</span>
              </div>
              {f.warnings.map((w) => <div key={w} className="alert alert-warning">{w}</div>)}

              <div className="form-row">
                <div className="form-field">
                  <label>Date column</label>
                  <select
                    className="select"
                    value={mappings[f.filename]?.date_column ?? ''}
                    onChange={(e) => updateMapping(f.filename, { date_column: e.target.value })}
                  >
                    <option value="">--</option>
                    {f.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Description column</label>
                  <select
                    className="select"
                    value={mappings[f.filename]?.description_column ?? ''}
                    onChange={(e) => updateMapping(f.filename, { description_column: e.target.value })}
                  >
                    <option value="">--</option>
                    {f.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Amount layout</label>
                  <select
                    className="select"
                    value={mappings[f.filename]?.amount_mode ?? 'single'}
                    onChange={(e) => updateMapping(f.filename, { amount_mode: e.target.value as 'single' | 'debit_credit' })}
                  >
                    <option value="single">Single amount column</option>
                    <option value="debit_credit">Separate debit/credit columns</option>
                  </select>
                </div>

                {(mappings[f.filename]?.amount_mode ?? 'single') === 'single' ? (
                  <div className="form-field">
                    <label>Amount column</label>
                    <select
                      className="select"
                      value={mappings[f.filename]?.amount_column ?? ''}
                      onChange={(e) => updateMapping(f.filename, { amount_column: e.target.value })}
                    >
                      <option value="">--</option>
                      {f.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="form-field">
                      <label>Debit column</label>
                      <select
                        className="select"
                        value={mappings[f.filename]?.debit_column ?? ''}
                        onChange={(e) => updateMapping(f.filename, { debit_column: e.target.value })}
                      >
                        <option value="">--</option>
                        {f.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Credit column</label>
                      <select
                        className="select"
                        value={mappings[f.filename]?.credit_column ?? ''}
                        onChange={(e) => updateMapping(f.filename, { credit_column: e.target.value })}
                      >
                        <option value="">--</option>
                        {f.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>{f.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {f.sample_rows.map((row, i) => (
                      <tr key={i}>
                        {f.columns.map((c) => <td key={c}>{row[c]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button className="btn btn-secondary" onClick={reset} disabled={busy}>Back</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={busy}>
              {busy && <span className="spinner" />}
              {busy ? 'Importing...' : 'Confirm import'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="card">
          <div className="card-title">Import complete</div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-value">{result.total_imported}</div>
              <div className="stat-label">Imported</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{result.total_skipped}</div>
              <div className="stat-label">Skipped (duplicates)</div>
            </div>
          </div>

          {result.files.map((f) => (
            <div key={f.filename} className="muted" style={{ marginBottom: '0.5rem' }}>
              <strong style={{ color: 'var(--text-h)' }}>{f.filename}</strong>: {f.imported} imported, {f.skipped_duplicates} skipped
              {f.errors.length > 0 && (
                <div className="alert alert-error section-gap">
                  {f.errors.length} row(s) could not be parsed:
                  <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>
                    {f.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                    {f.errors.length > 10 && <li>...and {f.errors.length - 10} more</li>}
                  </ul>
                </div>
              )}
            </div>
          ))}

          <div className="card-title section-gap">Categorization</div>
          {categorizing && (
            <div className="inline-loading">
              <span className="spinner" />
              Categorizing transactions with AI...
            </div>
          )}
          {categorizeError && <div className="alert alert-error">{categorizeError}</div>}
          {summaryResult && sortedBreakdown.length === 0 && (
            <p className="muted">No categorized transactions in this account yet.</p>
          )}
          {summaryResult && sortedBreakdown.length > 0 && (
            <>
              <p className="muted" style={{ marginBottom: '0.75rem' }}>
                {newlyCategorized > 0
                  ? `${newlyCategorized} new transaction(s) categorized. `
                  : ''}
                Showing all {summaryResult.total_transactions} categorized transaction(s) for this account.
              </p>
              <ul className="category-list">
                {sortedBreakdown.map(([category, entry]) => {
                  const amount = Number(entry.total_amount)
                  return (
                    <li key={category} className="category-row">
                      <span className="category-dot" style={{ background: categoryColorVar(category) }} />
                      <span className="category-name">{category}</span>
                      <span className="category-count">{entry.count} txn{entry.count === 1 ? '' : 's'}</span>
                      <span className={`category-amount ${amount > 0 ? 'positive' : amount < 0 ? 'negative' : ''}`}>
                        {formatAmount(entry.total_amount)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <div className="section-gap" style={{ display: 'flex', gap: '0.6rem' }}>
            <button className="btn btn-secondary" onClick={reset}>Upload more</button>
            {accountId !== null && (
              <button className="btn btn-primary" onClick={() => onViewDashboard?.(accountId)}>
                View dashboard
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
