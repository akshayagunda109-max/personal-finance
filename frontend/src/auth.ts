// Token storage + auth API calls.
//
// The token lives in localStorage: simple, survives refreshes, and works with
// the API on a different origin. The tradeoff is that any XSS on this page
// could read it - React escapes rendered values by default, and the app never
// uses dangerouslySetInnerHTML, which is what keeps that risk low.

import { API_BASE } from './config'

const TOKEN_KEY = 'pf_access_token'

export type User = { id: number; email: string; created_at: string }
export type TokenResponse = { access_token: string; token_type: string; user: User }

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    // FastAPI validation errors arrive as a list of {msg, loc, ...}.
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg
  } catch {
    // Non-JSON body (e.g. a proxy error page) - fall through.
  }
  return fallback
}

export async function signup(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await readError(res, 'Signup failed'))
  return res.json()
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await readError(res, 'Login failed'))
  return res.json()
}

export async function fetchMe(): Promise<User> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error('Not authenticated')
  return res.json()
}
