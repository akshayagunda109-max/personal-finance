// API base URL. Set VITE_API_BASE_URL at build time to point the frontend at a
// deployed backend; falls back to the local dev server.
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
