import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { canAccessFeature, getPlan, hasActivePlanAccess, isTrialActive, trialDaysRemaining, type FeatureKey } from '../lib/plans'

interface FeatureGateProps {
  feature: FeatureKey
  children?: ReactNode
  fallback?: ReactNode
  compact?: boolean
}

export function FeatureGate({ feature, children, fallback, compact = false }: FeatureGateProps) {
  const { profile } = useAuth()
  const plan = getPlan(profile)

  const active = hasActivePlanAccess(profile)
  if (active && canAccessFeature(plan, feature)) return <>{children}</>
  if (fallback) return <>{fallback}</>

  return (
    <div className={`feature-gate${compact ? ' compact' : ''}`}>
      <div className="feature-gate-icon">✦</div>
      <div>
        <strong>{isTrialActive(profile) ? 'Included in your free trial' : 'Your trial has ended'}</strong>
        <p>{isTrialActive(profile) ? `${trialDaysRemaining(profile)} day${trialDaysRemaining(profile) === 1 ? '' : 's'} remaining on ${plan === 'agency' ? 'Agency' : plan === 'professional' ? 'Professional' : 'Starter'}.` : 'Choose a paid plan to continue using this feature.'}</p>
        <Link to="/dashboard/profile" className="btn btn-blue btn-sm">View plan</Link>
      </div>
    </div>
  )
}
