import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from './LoadingSpinner'
import { supabaseConfigured } from '../lib/supabase'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (!supabaseConfigured) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h2 style={{ marginTop: 0, color: 'var(--heading)' }}>Configuration required</h2>
          <p className="muted">
            Copy <code>.env.example</code> to <code>.env.local</code> and add your Supabase URL and
            anon key, then restart the dev server.
          </p>
        </div>
      </div>
    )
  }

  if (loading) return <LoadingSpinner />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
