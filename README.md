# Personal Finance

A multi-user personal finance web app: sign up, bulk-import bank statements
(CSV/XLSX), have transactions categorized by AI, and see where the money goes.

**Stack:** FastAPI (Python) · React (Vite) · PostgreSQL · Gemini API

## Project layout

```
personal-finance/
  backend/    FastAPI app (API + database + migrations)
  frontend/   React app
  samples/    Example statement files for testing
```

## Running locally (dev)

**Backend**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # then fill in GEMINI_API_KEY
alembic upgrade head
uvicorn app.main:app --reload
```

API at http://localhost:8000 (docs at `/docs` in development only).

**Frontend**

```powershell
cd frontend
npm install
npm run dev
```

App at http://localhost:5173.

## Running the production-shaped stack locally

Verifies the built images, gunicorn, nginx, and migrations before deploying:

```powershell
copy .env.docker.example .env.docker   # fill in JWT_SECRET + GEMINI_API_KEY
docker compose --env-file .env.docker up --build
```

App at http://localhost:8080.

## Configuration

All config comes from environment variables (see `backend/.env.example`).
When `ENVIRONMENT=production`, the app refuses to start if `JWT_SECRET`,
`CORS_ORIGINS`, `DATABASE_URL`, or `GEMINI_API_KEY` still hold dev defaults.

Generate a signing key with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## Auth model

- Email + password signup/login; passwords hashed with bcrypt.
- Login returns a JWT the frontend stores in `localStorage` and sends as
  `Authorization: Bearer <token>`.
- Every account and transaction is owned by a user; all queries filter on the
  caller's id, and another user's account id returns 404 rather than 403.
- Signup and login are rate-limited per IP.

## Feature status

1. [x] Project scaffold + health check
2. [x] Bulk statement upload (CSV/XLSX) with column auto-detection + dedupe
3. [x] AI categorization + clean merchant names (Gemini)
4. [x] Dashboard: KPIs, monthly trend, category breakdown, drill-down, AI insights
5. [x] Filters (date range, credit/debit, category)
6. [x] Multi-user auth + per-user data isolation
7. [x] Containerized for deployment
8. [ ] Deployed to AWS
