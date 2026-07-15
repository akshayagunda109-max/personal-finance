# Personal Finance

A multi-user personal finance web app. Sign up, bulk-upload your bank
statements (CSV/XLSX), and get your transactions automatically categorized by
AI — then explore where the money actually goes.

**Stack:** FastAPI (Python 3.12) · React + TypeScript (Vite) · PostgreSQL · Gemini API

## Features

- **Bulk statement upload** — drop in multiple CSV/XLSX files at once. Column
  layouts are auto-detected (handles both a single signed `Amount` column and
  separate `Debit`/`Credit` columns), with a preview step to confirm or correct
  the mapping before importing.
- **Duplicate-safe imports** — re-uploading an overlapping statement skips rows
  that are already there instead of double-counting them.
- **AI categorization** — transactions are sorted into buckets (Food & Dining,
  Groceries, Travel, Investing/Trading, …), and cryptic bank strings like
  `UPI/P2M/603419415923/Swiggy /Swiggy/AIRTEL PAYMENTS BANK` are turned into
  readable names like `Swiggy`.
- **Dashboard** — income/spend/net totals, monthly spend trend, and a category
  breakdown you can click into for an AI-written summary of what's driving it.
- **Filters** — by date range, credit vs debit, and category.
- **Manual overrides** — fix any category the AI got wrong, or invent your own.
- **Multi-user** — each user only ever sees their own accounts and transactions.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.12+ | |
| Node.js | 20+ | |
| PostgreSQL | 14+ | 17 recommended |
| Gemini API key | — | Free tier works: https://aistudio.google.com/apikey |

On Windows these can be installed with:

```powershell
winget install Python.Python.3.12 OpenJS.NodeJS.LTS PostgreSQL.PostgreSQL.17
```

## Setup

### 1. Clone

```bash
git clone https://github.com/akshayagunda109-max/personal-finance.git
cd personal-finance
```

### 2. Create the database

```bash
psql -U postgres -c "CREATE DATABASE finance;"
```

### 3. Backend

```bash
cd backend
python -m venv .venv
```

Activate it — Windows: `.\.venv\Scripts\Activate.ps1` · macOS/Linux: `source .venv/bin/activate`

```bash
pip install -r requirements.txt
cp .env.example .env      # Windows: copy .env.example .env
```

Now edit `backend/.env` and set at minimum:

- `DATABASE_URL` — if your Postgres password isn't `postgres`
- `GEMINI_API_KEY` — required for categorization and AI summaries

Then create the tables and start the API:

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

The API runs at **http://localhost:8000** (interactive docs at `/docs` in
development).

### 4. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app runs at **http://localhost:5173**.

### 5. Try it

1. Open http://localhost:5173 and create an account.
2. On **Upload statements**, create an account (e.g. "HDFC Savings"), pick a
   currency, and drop in a statement. No statement handy? Use the files in
   [`samples/`](samples/) — they cover both supported column layouts.
3. Confirm the detected column mapping and import.
4. Hit **View dashboard**.

## Configuration

All configuration is via environment variables — see
[`backend/.env.example`](backend/.env.example) for the full list.

| Variable | Default | Purpose |
|---|---|---|
| `ENVIRONMENT` | `development` | `production` enables strict startup checks |
| `DATABASE_URL` | local postgres | SQLAlchemy connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed browser origins |
| `JWT_SECRET` | dev placeholder | **Must** be replaced outside development |
| `JWT_EXPIRE_MINUTES` | `10080` (7 days) | Token lifetime |
| `GEMINI_API_KEY` | — | Required for AI features |
| `GEMINI_MODEL` | `gemini-flash-lite-latest` | Model used for categorization |

Frontend build-time config:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Where the browser reaches the API |

Generate a real signing key with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

When `ENVIRONMENT=production`, the app **refuses to start** if `JWT_SECRET`,
`CORS_ORIGINS`, `DATABASE_URL`, or `GEMINI_API_KEY` still contain development
defaults — so a misconfigured deploy fails loudly instead of running insecurely.

## Running the production stack locally (Docker)

Builds the real images (gunicorn + nginx) against Postgres, so deployment
problems surface locally rather than in the cloud:

```bash
cp .env.docker.example .env.docker    # then fill in JWT_SECRET + GEMINI_API_KEY
docker compose --env-file .env.docker up --build
```

App at **http://localhost:8080**, API at **http://localhost:8000**.

## Architecture

```
backend/
  app/
    main.py          FastAPI app, middleware, CORS, logging
    config.py        Env-driven settings + production safety checks
    database.py      SQLAlchemy engine/session
    dependencies.py  Auth + per-user ownership guards
    models/          ORM: User, Account, Transaction
    routers/         auth, accounts, statements, transactions
    schemas/         Pydantic request/response models
    services/        Statement parsing, AI categorization, AI insights
  alembic/           Database migrations

frontend/
  src/
    api.ts             Typed API client (attaches auth token)
    auth.ts            Token storage + auth calls
    components/        AuthScreen, StatementUpload, Dashboard
    charts/            Category bar chart, monthly trend chart
    categoryColors.ts  Colorblind-safe category palette
```

### Security notes

- Passwords are hashed with bcrypt; plaintext is never stored or logged.
- Auth uses JWT bearer tokens, stored client-side in `localStorage`.
- Every query is scoped to the authenticated user. Requesting another user's
  account returns `404`, never `403` — the API never reveals that someone
  else's records exist.
- Signup and login are rate-limited per IP.
- API docs are disabled when `ENVIRONMENT=production`.

## Database migrations

After changing an ORM model:

```bash
cd backend
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```

## Roadmap

- [x] Bulk statement upload with column auto-detection and dedupe
- [x] AI categorization + readable merchant names
- [x] Dashboard with charts, drill-down, and AI insights
- [x] Filters (date, credit/debit, category)
- [x] Multi-user auth with per-user data isolation
- [x] Containerized for deployment
- [ ] Deploy to AWS
- [ ] Budgets and alerts

## License

Not currently licensed for reuse. All rights reserved.
