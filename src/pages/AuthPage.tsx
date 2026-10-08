import { FormEvent, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabaseConfigured } from '../lib/supabase'
import { LoadingSpinner } from '../components/LoadingSpinner'
<<<<<<< HEAD
import { PLAN_CONFIG, type Plan } from '../lib/plans'
=======
>>>>>>> c98eb7acb7cfce65c1b4c0831f03af377b3b7569

type Mode = 'login' | 'signup'

export function AuthPage({ mode }: { mode: Mode }) {
  const { signIn, signUp, session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
<<<<<<< HEAD
  const requestedPlan = new URLSearchParams(location.search).get('plan') as Plan | null
  const initialPlan: Plan = requestedPlan === 'starter' || requestedPlan === 'professional' || requestedPlan === 'agency' ? requestedPlan : 'starter'
=======
>>>>>>> c98eb7acb7cfce65c1b4c0831f03af377b3b7569

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
<<<<<<< HEAD
  const [selectedPlan, setSelectedPlan] = useState<Plan>(initialPlan)
=======
>>>>>>> c98eb7acb7cfce65c1b4c0831f03af377b3b7569
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const notice = (location.state as { notice?: string } | null)?.notice

  if (loading) return <LoadingSpinner />
  if (session) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    if (mode === 'signup') {
<<<<<<< HEAD
      const err = await signUp(email.trim(), password, fullName.trim(), selectedPlan)
=======
      const err = await signUp(email.trim(), password, fullName.trim())
>>>>>>> c98eb7acb7cfce65c1b4c0831f03af377b3b7569
      setSubmitting(false)
      if (err) {
        setError(err)
        return
      }
      navigate('/login', {
        state: {
          notice:
            'Account created. If email confirmation is enabled in Supabase, check your inbox before logging in.',
        },
      })
      return
    }

    const err = await signIn(email.trim(), password)
    setSubmitting(false)
    if (err) {
      setError(err)
      return
    }
    navigate(from)
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <Link to="/" className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
          ← Back home
        </Link>
        <h1 style={{ margin: '12px 0 4px', color: 'var(--heading)' }}>
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {mode === 'signup'
<<<<<<< HEAD
            ? 'Choose a plan and start your 5-day free trial. No payment is required to begin.'
=======
            ? 'Start managing properties in your agent dashboard.'
>>>>>>> c98eb7acb7cfce65c1b4c0831f03af377b3b7569
            : 'Sign in to access your properties and profile.'}
        </p>

        {!supabaseConfigured && (
          <div className="info-banner" style={{ marginBottom: 14 }}>
            Add Supabase credentials to <code>.env.local</code> to enable authentication.
          </div>
        )}

        <div className="tabs">
          <Link to="/signup" className={`tab${mode === 'signup' ? ' active' : ''}`}>
            Sign up
          </Link>
          <Link to="/login" className={`tab${mode === 'login' ? ' active' : ''}`}>
            Log in
          </Link>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}
        {notice && mode === 'login' && (
          <div className="info-banner" style={{ marginBottom: 14 }}>
            {notice}
          </div>
        )}

        <form onSubmit={(e) => void onSubmit(e)}>
          {mode === 'signup' && (
            <div className="field">
              <label className="label" htmlFor="fullName">
                Full name
              </label>
              <input
                id="fullName"
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}
<<<<<<< HEAD
          {mode === 'signup' && (
            <div className="field">
              <label className="label">Choose your plan</label>
              <div className="signup-plan-grid">
                {(Object.keys(PLAN_CONFIG) as Plan[]).map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    className={`signup-plan-option${selectedPlan === plan ? ' selected' : ''}`}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <strong>{PLAN_CONFIG[plan].name}</strong>
                    <span>US${PLAN_CONFIG[plan].price}/month</span>
                    <small>5 days free</small>
                  </button>
                ))}
              </div>
              <small className="field-help">Your selected plan is free for 5 days. You can pay after the trial.</small>
            </div>
          )}
=======
>>>>>>> c98eb7acb7cfce65c1b4c0831f03af377b3b7569
          <div className="field">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>
          <button type="submit" className="btn btn-blue" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
          <p className="auth-switch">
            {mode === 'login' ? (
              <>Don&apos;t have an account? <Link to="/signup">Create one</Link></>
            ) : (
              <>Already have an account? <Link to="/login">Log in</Link></>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}
