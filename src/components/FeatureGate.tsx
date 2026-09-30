import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  canAccessFeature,
  featureUpgradeMessage,
  getPlan,
  type FeatureKey,
} from '../lib/plans'

interface FeatureGateProps {
  feature: FeatureKey
  children?: ReactNode
  fallback?: ReactNode
  compact?: boolean
}

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