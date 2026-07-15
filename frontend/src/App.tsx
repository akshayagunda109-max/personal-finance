import { useEffect, useState } from 'react'
import './App.css'
import { StatementUpload } from './components/StatementUpload'
import { Dashboard } from './components/Dashboard'

const API_BASE = 'http://localhost:8000'

type HealthResponse = {
  status: string
  database: string
}

type Tab = 'dashboard' | 'upload'

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('upload')
  const [dashboardAccountId, setDashboardAccountId] = useState<number | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`Backend responded with ${res.status}`)
        return res.json()
      })
      .then(setHealth)
      .catch((err) => setError(err.message))
  }, [])

  const isOk = health?.status === 'ok' && health?.database === 'connected'

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Personal Finance</h1>
        <span className={`status-pill ${error ? 'error' : isOk ? 'ok' : ''}`}>
          <span className="dot" />
          {error ? 'Backend unreachable' : isOk ? 'Connected' : 'Checking...'}
        </span>
      </header>

      <nav className="tab-nav">
        <button className={`tab-btn ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>
          Upload statements
        </button>
        <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          Dashboard
        </button>
      </nav>

      {tab === 'dashboard' ? (
        <Dashboard initialAccountId={dashboardAccountId} />
      ) : (
        <StatementUpload
          onViewDashboard={(accountId) => {
            setDashboardAccountId(accountId)
            setTab('dashboard')
          }}
        />
      )}
    </div>
  )
}

export default App
