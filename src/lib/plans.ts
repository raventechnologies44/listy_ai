import type { Profile, SubscriptionStatus } from '../types/database'

export type Plan = 'starter' | 'professional' | 'agency'

export type FeatureKey =
  | 'ai_property_description'
  | 'ai_social_marketing'
  | 'ai_whatsapp_marketing'
  | 'ai_video_scripts'
  | 'ai_matching'
  | 'ai_follow_up'
  | 'whatsapp_business'
  | 'advanced_analytics'
  | 'scheduled_campaigns'
  | 'agency_workspace'

export interface PlanConfig {
  name: string
  price: number
  propertyLimit: number | null
  agentLimit: number
  features: readonly FeatureKey[]
}

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  starter: {
    name: 'Starter',
    price: 15,
    propertyLimit: 10,
    agentLimit: 1,
    features: [
      'ai_property_description',
      'ai_social_marketing',
    ],
  },
  professional: {
    name: 'Professional',
    price: 25,
    propertyLimit: 50,
    agentLimit: 1,
    features: [
      'ai_property_description',
      'ai_social_marketing',
      'ai_whatsapp_marketing',
      'ai_video_scripts',
      'ai_matching',
      'ai_follow_up',
      'whatsapp_business',
      'advanced_analytics',
      'scheduled_campaigns',
    ],
  },
  agency: {
    name: 'Agency',
    price: 50,
    propertyLimit: null,
    agentLimit: 5,
    features: [
      'ai_property_description',
      'ai_social_marketing',
      'ai_whatsapp_marketing',
      'ai_video_scripts',
      'ai_matching',
      'ai_follow_up',
      'whatsapp_business',
      'advanced_analytics',
      'scheduled_campaigns',
      'agency_workspace',
    ],
  },
}

/**
 * Existing profiles created before subscription plans were introduced should
 * retain access to the existing product while the billing layer is connected.
 * The database migration sets existing rows explicitly; this fallback is only
 * for older databases that have not run migration 006 yet.
 */
export function getPlan(profile: Profile | null | undefined): Plan {
  if (profile?.subscription_plan === 'starter' || profile?.subscription_plan === 'professional' || profile?.subscription_plan === 'agency') {
    return profile.subscription_plan
  }
  return 'professional'
}

export function canAccessFeature(plan: Plan, feature: FeatureKey): boolean {
  return PLAN_CONFIG[plan].features.includes(feature)
}

export function canCreateProperty(plan: Plan, activePropertyCount: number): boolean {
  const limit = PLAN_CONFIG[plan].propertyLimit
  return limit === null || activePropertyCount < limit
}

export function planLabel(plan: Plan): string {
  return PLAN_CONFIG[plan].name
}

export function planPrice(plan: Plan): string {
  return `US$${PLAN_CONFIG[plan].price}/month`
}

export function isTrialActive(profile: Profile | null | undefined, now = new Date()): boolean {
  if (!profile?.trial_ends_at) return false
  if (profile.subscription_status !== 'trial') return false
  return new Date(profile.trial_ends_at).getTime() > now.getTime()
}

export function trialDaysRemaining(profile: Profile | null | undefined, now = new Date()): number {
  if (!isTrialActive(profile, now) || !profile?.trial_ends_at) return 0
  const remaining = new Date(profile.trial_ends_at).getTime() - now.getTime()
  return Math.max(0, Math.ceil(remaining / 86400000))
}

export function isTrialExpired(profile: Profile | null | undefined, now = new Date()): boolean {
  if (!profile?.trial_ends_at) return false
  return profile.subscription_status === 'trial' && new Date(profile.trial_ends_at).getTime() <= now.getTime()
}

export function hasActivePlanAccess(profile: Profile | null | undefined, now = new Date()): boolean {
  if (!profile) return false
  if (profile.subscription_status === 'active') return true
  return isTrialActive(profile, now)
}

export function subscriptionStatusLabel(status: SubscriptionStatus | null | undefined): string {
  if (status === 'trial') return 'Free trial'
  if (status === 'active') return 'Active'
  if (status === 'pending') return 'Payment pending'
  if (status === 'expired') return 'Trial ended'
  return 'Subscription'
}

export function featureUpgradeMessage(feature: FeatureKey): string {
  const professionalFeatures: FeatureKey[] = [
    'ai_whatsapp_marketing',
    'ai_video_scripts',
    'ai_matching',
    'ai_follow_up',
    'whatsapp_business',
    'advanced_analytics',
    'scheduled_campaigns',
  ]
  return professionalFeatures.includes(feature)
    ? 'This feature is available on Professional and Agency plans.'
    : 'This feature is available on your current plan.'
}
