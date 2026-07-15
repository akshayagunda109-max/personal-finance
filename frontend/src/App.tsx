import { useEffect, useState } from 'react'
import './App.css'
import type { User } from './auth'
import { clearToken, fetchMe, getToken } from './auth'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { StatementUpload } from './components/StatementUpload'

type Tab = 'dashboard' | 'upload'

function App() {
  const [user, setUser] = useState<User | null>(null)
  // Distinct from "no user": on first paint we don't yet know whether the
  // stored token is still valid, and flashing the login screen at a signed-in
  // user would be wrong.
  const [checkingSession, setCheckingSession] = useState(true)
  const [tab, setTab] = useState<Tab>('upload')
  const [dashboardAccountId, setDashboardAccountId] = useState<number | null>(null)

  useEffect(() => {
    if (!getToken()) {
      setCheckingSession(false)
      return
    }
    fetchMe()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setCheckingSession(false))
  }, [])

  function handleSignOut() {
    clearToken()
    setUser(null)
    setTab('upload')
    setDashboardAccountId(null)
  }

  if (checkingSession) {
    return (
      <div className="auth-shell">
        <div className="inline-loading">
          <span className="spinner" />
          Loading...
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Personal Finance</h1>
        <div className="header-actions">
          <span className="muted">{user.email}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleSignOut}>Sign out</button>
        </div>
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
