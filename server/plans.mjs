const FEATURES = {
  starter: new Set(['ai_property_description', 'ai_social_marketing']),
  professional: new Set([
    'ai_property_description',
    'ai_social_marketing',
    'ai_whatsapp_marketing',
    'ai_video_scripts',
    'ai_matching',
    'ai_follow_up',
    'whatsapp_business',
    'advanced_analytics',
    'scheduled_campaigns',
  ]),
  agency: new Set([
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
  ]),
}

const TASK_FEATURE = {
  property_description: 'ai_property_description',
  social_caption: 'ai_social_marketing',
  hashtags: 'ai_social_marketing',
  whatsapp_ad: 'ai_whatsapp_marketing',
  video_script: 'ai_video_scripts',
  follow_up: 'ai_follow_up',
  whatsapp_reply: 'whatsapp_business',
}

export function normalizePlan(value) {
  return value === 'starter' || value === 'professional' || value === 'agency' ? value : 'professional'
}

export function featureForAiTask(task) {
  return TASK_FEATURE[task] || null
}

export function canAccessFeature(plan, feature) {
  if (!plan) return false
  return FEATURES[normalizePlan(plan)]?.has(feature) || false
}

export function hasActiveSubscription(profile) {
  if (!profile) return false
  if (profile.subscription_status === 'active') return true
  if (profile.subscription_status !== 'trial' || !profile.trial_ends_at) return false
  return new Date(profile.trial_ends_at).getTime() > Date.now()
}

export function planForTask(task) {
  return featureForAiTask(task)
}
