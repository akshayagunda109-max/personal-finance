const API_BASE = 'http://localhost:8000'

export type Account = { id: number; name: string; institution: string | null; currency: string }

export async function listAccounts(): Promise<Account[]> {
  const res = await fetch(`${API_BASE}/api/accounts`)
  if (!res.ok) throw new Error('Failed to load accounts')
  return res.json()
}

export async function createAccount(input: { name: string; institution?: string; currency?: string }): Promise<Account> {
  const res = await fetch(`${API_BASE}/api/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create account')
  return res.json()
}

export type ColumnMapping = {
  date_column: string
  description_column: string
  amount_mode: 'single' | 'debit_credit'
  amount_column?: string | null
  debit_column?: string | null
  credit_column?: string | null
}

export type FilePreview = {
  filename: string
  columns: string[]
  sample_rows: Record<string, string>[]
  row_count: number
  suggested_mapping: ColumnMapping | null
  warnings: string[]
}

export async function previewStatements(files: File[]): Promise<{ files: FilePreview[] }> {
  const formData = new FormData()
  files.forEach((f) => formData.append('files', f))
  const res = await fetch(`${API_BASE}/api/statements/preview`, { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Preview failed')
  return res.json()
}

export type FileImportResult = { filename: string; imported: number; skipped_duplicates: number; errors: string[] }
export type ImportResponse = { files: FileImportResult[]; total_imported: number; total_skipped: number }

export async function importStatements(
  accountId: number,
  files: File[],
  mappings: { filename: string; mapping: ColumnMapping }[],
): Promise<ImportResponse> {
  const formData = new FormData()
  formData.append('account_id', String(accountId))
  formData.append('mappings', JSON.stringify(mappings))
  files.forEach((f) => formData.append('files', f))
  const res = await fetch(`${API_BASE}/api/statements/import`, { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Import failed')
  return res.json()
}

export type CategoryBreakdownEntry = { count: number; total_amount: string }
export type CategorizeResponse = { categorized: number; breakdown: Record<string, CategoryBreakdownEntry> }

export async function categorizeTransactions(accountId: number): Promise<CategorizeResponse> {
  const res = await fetch(`${API_BASE}/api/transactions/categorize?account_id=${accountId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Categorization failed')
  return res.json()
}

export type CategorySummaryResponse = { total_transactions: number; breakdown: Record<string, CategoryBreakdownEntry> }

export async function getCategorySummary(accountId: number): Promise<CategorySummaryResponse> {
  const res = await fetch(`${API_BASE}/api/transactions/category-summary?account_id=${accountId}`)
  if (!res.ok) throw new Error('Failed to load category summary')
  return res.json()
}

export type MonthlySummaryEntry = { month: string; total_spend: string; total_income: string }
export type MonthlySummaryResponse = { months: MonthlySummaryEntry[] }

export async function getMonthlySummary(accountId: number): Promise<MonthlySummaryResponse> {
  const res = await fetch(`${API_BASE}/api/transactions/monthly-summary?account_id=${accountId}`)
  if (!res.ok) throw new Error('Failed to load monthly summary')
  return res.json()
}

export type Transaction = {
  id: number
  account_id: number
  date: string
  description: string
  display_name: string | null
  amount: string
  currency: string
  source_file: string
  category: string | null
  created_at: string
}

export async function listTransactions(accountId: number, category?: string): Promise<Transaction[]> {
  const params = new URLSearchParams({ account_id: String(accountId) })
  if (category) params.set('category', category)
  const res = await fetch(`${API_BASE}/api/transactions?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to load transactions')
  return res.json()
}

export type CategoryInsightResponse = { category: string; transaction_count: number; summary: string }

export async function getCategoryInsight(accountId: number, category: string): Promise<CategoryInsightResponse> {
  const params = new URLSearchParams({ account_id: String(accountId), category })
  const res = await fetch(`${API_BASE}/api/transactions/category-insight?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to load category insight')
  return res.json()
}

export async function updateTransactionCategory(transactionId: number, category: string): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/api/transactions/${transactionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  })
  if (!res.ok) throw new Error('Failed to update category')
  return res.json()
}
