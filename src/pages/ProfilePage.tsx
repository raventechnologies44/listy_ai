import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { getPlan, PLAN_CONFIG, planPrice, isTrialActive, isTrialExpired, trialDaysRemaining, type Plan } from '../lib/plans'

const planFeatures: Record<Plan, string[]> = {
  starter: [
    'Up to 10 active listings',
    'AI property descriptions',
    'AI social captions and hashtags',
    'WhatsApp enquiries and manual lead capture',
    'Lead pipeline and follow-up tracking',
    'Scheduling and basic analytics',
  ],
  professional: [
    'Up to 50 active listings',
    'Full AI marketing suite',
    'WhatsApp Business connection',
    'AI lead extraction and suggested replies',
    'AI property matching',
    'AI-written personalised follow-ups',
    'Scheduled campaigns and advanced analytics',
  ],
  agency: [
    'Unlimited active listings',
    'Up to 5 agent accounts',
    'Full AI and WhatsApp functionality',
    'Shared lead pool and team scheduling',
    'Agency-wide analytics and reports',
    'Team roles and priority support',
  ],
}

export function ProfilePage() {
  const { profile, profileLoading, updateProfile, user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [brokerage, setBrokerage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFullName(profile?.full_name ?? '')
    setPhone(profile?.phone ?? '')
    setBrokerage(profile?.brokerage ?? '')
  }, [profile])

  if (profileLoading && !profile) return <LoadingSpinner />

  const plan = getPlan(profile)
  const config = PLAN_CONFIG[plan]

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)
    const err = await updateProfile({
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
      brokerage: brokerage.trim() || null,
    })
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    setSuccess(true)
  }

  return (
    <div className="settings-page">
      <div style={{ marginBottom: 18 }}>
        <span className="eyebrow">ACCOUNT</span>
        <h2 className="page-title" style={{ margin: '5px 0 3px' }}>Settings & profile</h2>
        <p className="muted" style={{ margin: 0 }}>Manage your profile and view your ListyAI plan.</p>
      </div>

      <div className="settings-grid">
        <form className="card pad" onSubmit={(e) => void onSubmit(e)}>
          <div className="section-heading" style={{ marginBottom: 15 }}>
            <h3 style={{ margin: 0, color: 'var(--heading)' }}>Agent profile</h3>
            <p style={{ marginTop: 4 }}>These details help personalize your workspace and AI outputs.</p>
          </div>
          {error && <div className="error-banner" style={{ marginBottom: 14 }}>{error}</div>}
          {success && <div className="info-banner" style={{ marginBottom: 14, background: '#ecfdf5', borderColor: '#bbf7d0', color: '#166534' }}>Profile saved.</div>}
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" value={user?.email ?? profile?.email ?? ''} disabled />
          </div>
          <div className="field">
            <label className="label" htmlFor="fullName">Full name</label>
            <input id="fullName" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="phone">Phone</label>
            <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="brokerage">Brokerage</label>
            <input id="brokerage" className="input" value={brokerage} onChange={(e) => setBrokerage(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-blue" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
        </form>

        <section className="card pad plan-card-large">
          <div className="plan-card-header">
            <div>
              <span className="eyebrow">CURRENT PLAN</span>
              <h3>{config.name}</h3>
            </div>
            <strong>{planPrice(plan)}</strong>
          </div>
          {isTrialActive(profile) ? (
            <div className="info-banner" style={{ marginBottom: 14 }}>
              <strong>{trialDaysRemaining(profile)} day{trialDaysRemaining(profile) === 1 ? '' : 's'} left</strong> in your free {config.name} trial. No payment is required until the trial ends.
            </div>
          ) : isTrialExpired(profile) || profile?.subscription_status === 'expired' ? (
            <div className="error-banner" style={{ marginBottom: 14 }}>
              Your 5-day free trial has ended. Choose a plan and submit payment to continue.
            </div>
          ) : null}
          <p className="muted">Your plan controls which ListyAI capabilities are available to your account.</p>
          <div className="plan-feature-list">
            {planFeatures[plan].map((feature) => <div key={feature}><span>✓</span>{feature}</div>)}
          </div>
          <div className="plan-note">
            Manage your subscription and EcoCash payments from the billing area. Payment credentials are never stored in this profile screen.
          </div>
          <div style={{ marginTop: 14 }}>
            <Link to="/dashboard/billing" className="btn btn-blue">Manage billing & payments</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
