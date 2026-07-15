import { clearToken, getToken } from './auth'
import { API_BASE } from './config'

/** Raised when the API rejects our token - the app should send the user back to login. */
export class UnauthorizedError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again.')
    this.name = 'UnauthorizedError'
  }
}

/**
 * fetch wrapper that attaches the bearer token and turns non-2xx responses into
 * errors, so no caller has to remember either. A 401 also drops the stored
 * token, since it is definitively no longer usable.
 */
async function authFetch(path: string, init: RequestInit = {}, errorMessage = 'Request failed'): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })

  if (res.status === 401) {
    clearToken()
    throw new UnauthorizedError()
  }
  if (!res.ok) {
    let detail = errorMessage
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      // Non-JSON error body - keep the generic message.
    }
    throw new Error(detail)
  }
  return res
}

async function authJson<T>(path: string, init: RequestInit = {}, errorMessage?: string): Promise<T> {
  const res = await authFetch(path, init, errorMessage)
  return res.json() as Promise<T>
}

export type Account = { id: number; name: string; institution: string | null; currency: string }

export function listAccounts(): Promise<Account[]> {
  return authJson('/api/accounts', {}, 'Failed to load accounts')
}

export function createAccount(input: { name: string; institution?: string; currency?: string }): Promise<Account> {
  return authJson('/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }, 'Failed to create account')
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

export function previewStatements(files: File[]): Promise<{ files: FilePreview[] }> {
  const formData = new FormData()
  files.forEach((f) => formData.append('files', f))
  return authJson('/api/statements/preview', { method: 'POST', body: formData }, 'Preview failed')
}

export type FileImportResult = { filename: string; imported: number; skipped_duplicates: number; errors: string[] }
export type ImportResponse = { files: FileImportResult[]; total_imported: number; total_skipped: number }

export function importStatements(
  accountId: number,
  files: File[],
  mappings: { filename: string; mapping: ColumnMapping }[],
): Promise<ImportResponse> {
  const formData = new FormData()
  formData.append('account_id', String(accountId))
  formData.append('mappings', JSON.stringify(mappings))
  files.forEach((f) => formData.append('files', f))
  return authJson('/api/statements/import', { method: 'POST', body: formData }, 'Import failed')
}

export type CategoryBreakdownEntry = { count: number; total_amount: string }
export type CategorizeResponse = { categorized: number; breakdown: Record<string, CategoryBreakdownEntry> }

export function categorizeTransactions(accountId: number): Promise<CategorizeResponse> {
  return authJson(
    `/api/transactions/categorize?account_id=${accountId}`,
    { method: 'POST' },
    'Categorization failed',
  )
}

export type CategorySummaryResponse = { total_transactions: number; breakdown: Record<string, CategoryBreakdownEntry> }

export function getCategorySummary(accountId: number): Promise<CategorySummaryResponse> {
  return authJson(
    `/api/transactions/category-summary?account_id=${accountId}`,
    {},
    'Failed to load category summary',
  )
}

export type MonthlySummaryEntry = { month: string; total_spend: string; total_income: string }
export type MonthlySummaryResponse = { months: MonthlySummaryEntry[] }

export function getMonthlySummary(accountId: number): Promise<MonthlySummaryResponse> {
  return authJson(
    `/api/transactions/monthly-summary?account_id=${accountId}`,
    {},
    'Failed to load monthly summary',
  )
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

export function listTransactions(accountId: number, category?: string): Promise<Transaction[]> {
  const params = new URLSearchParams({ account_id: String(accountId) })
  if (category) params.set('category', category)
  return authJson(`/api/transactions?${params.toString()}`, {}, 'Failed to load transactions')
}

export type CategoryInsightResponse = { category: string; transaction_count: number; summary: string }

export function getCategoryInsight(accountId: number, category: string): Promise<CategoryInsightResponse> {
  const params = new URLSearchParams({ account_id: String(accountId), category })
  return authJson(`/api/transactions/category-insight?${params.toString()}`, {}, 'Failed to load category insight')
}

export function updateTransactionCategory(transactionId: number, category: string): Promise<Transaction> {
  return authJson(`/api/transactions/${transactionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  }, 'Failed to update category')
}
