import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
<<<<<<< HEAD
import { canAccessFeature, getPlan, hasActivePlanAccess, isTrialActive, trialDaysRemaining, type FeatureKey } from '../lib/plans'
=======
import {
  canAccessFeature,
  featureUpgradeMessage,
  getPlan,
  type FeatureKey,
} from '../lib/plans'
>>>>>>> c98eb7acb7cfce65c1b4c0831f03af377b3b7569

interface FeatureGateProps {
  feature: FeatureKey
  children?: ReactNode
  fallback?: ReactNode
  compact?: boolean
}

<<<<<<< HEAD
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
=======
export function FeatureGate({
  feature,
  children,
  fallback,
  compact = false,
}: FeatureGateProps) {
  const { profile } = useAuth()
  const plan = getPlan(profile)

  // User has access: render the protected content.
  if (canAccessFeature(plan, feature)) {
    return <>{children}</>
  }

  // Custom fallback supplied by the parent.
  if (fallback) {
    return <>{fallback}</>
  }

  // User does not have access: show the upgrade message.
  return (
    <div className={`feature-gate${compact ? ' compact' : ''}`}>
      <div className="feature-gate-icon" aria-hidden="true">
        ✦
      </div>

      <div>
        <strong>Upgrade to unlock this feature</strong>

        <p>{featureUpgradeMessage(feature)}</p>

        <Link
          to="/dashboard/profile"
          className="btn btn-blue btn-sm"
        >
          View plan
        </Link>
      </div>
    </div>
  )
}
>>>>>>> c98eb7acb7cfce65c1b4c0831f03af377b3b7569
