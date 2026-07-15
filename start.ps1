# Starts the local dev stack: backend API + frontend dev server.
#
#   .\start.ps1
#
# Opens each server in its own window so you can read their logs and stop them
# independently with Ctrl+C. Postgres is expected to already be running as a
# Windows service (it's set to start automatically).

$ErrorActionPreference = "Stop"

$backend = Join-Path $PSScriptRoot "backend"
$frontend = Join-Path $PSScriptRoot "frontend"
$venvPython = Join-Path $backend ".venv\Scripts\python.exe"

# Re-read PATH from the registry. Child processes inherit this shell's PATH, so
# if this script is launched from a terminal that was open before Node/Python
# were installed, that stale PATH would follow them and `npm` would not resolve.
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

# --- Preflight -------------------------------------------------------------

$pg = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if (-not $pg) {
    Write-Host "PostgreSQL service not found. Is PostgreSQL installed?" -ForegroundColor Red
    exit 1
}
if ($pg.Status -ne "Running") {
    Write-Host "Starting PostgreSQL..." -ForegroundColor Yellow
    Start-Service $pg.Name
}
Write-Host "PostgreSQL: running" -ForegroundColor Green

if (-not (Test-Path $venvPython)) {
    Write-Host "Backend venv missing. Run: cd backend; python -m venv .venv; .\.venv\Scripts\pip.exe install -r requirements.txt" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $backend ".env"))) {
    Write-Host "backend\.env missing. Copy .env.example to .env and fill in GEMINI_API_KEY." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Write-Host "Frontend deps missing. Run: cd frontend; npm install" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm not found on PATH. Is Node.js installed?" -ForegroundColor Red
    exit 1
}

# --- Launch ----------------------------------------------------------------

# Calling the venv's python.exe directly avoids Activate.ps1, which the default
# PowerShell execution policy often blocks.
Write-Host "Starting backend on http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$backend'; & '$venvPython' -m uvicorn app.main:app --reload"
)

Write-Host "Starting frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$frontend'; npm run dev"
)

# Give the servers a moment before the browser hits them, so the first request
# doesn't land on a connection-refused.
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "Both servers are starting in their own windows." -ForegroundColor Green
Write-Host "Close those windows (or Ctrl+C in them) to stop." -ForegroundColor Green
