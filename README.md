# Personal Finance

A personal finance web app: track accounts and transactions, bulk-import bank
statements (CSV/XLSX), categorize spending, and see where the money goes.

**Stack:** FastAPI (Python) · React (Vite) · PostgreSQL

## Project layout

```
personal-finance/
  backend/    FastAPI app (API + database)
  frontend/   React app (Vite dev server)
```

## Backend — run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # then edit DATABASE_URL if needed
uvicorn app.main:app --reload
```

API runs at http://localhost:8000 — health check at http://localhost:8000/api/health,
interactive docs at http://localhost:8000/docs.

## Feature roadmap

1. [x] Project scaffold + health check
2. [ ] Accounts
3. [ ] Transactions
4. [ ] Bulk statement upload (CSV/XLSX)
5. [ ] Categories & auto-categorization
6. [ ] Dashboard
7. [ ] Budgets
