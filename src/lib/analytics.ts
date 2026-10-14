import type { AgentSchedule, Lead, Property } from '../types/database'
import { ACTIVE_STATUSES } from '../types/database'
import { bucketFollowUp, startOfLocalDay } from './dates'

export interface AnalyticsSnapshot {
  totalProperties: number
  activeListings: number
  totalLeads: number
  leadViewings: number
  leadNegotiations: number
  closedDeals: number
  followUpsOverdue: number
  followUpsToday: number
  upcomingViewings: number
  scheduledMarketingPosts: number
}

export function computeAnalytics(
  properties: Property[],
  leads: Lead[],
  schedules: AgentSchedule[],
  now = new Date(),
): AnalyticsSnapshot {
  const activeListings = properties.filter((p) => ACTIVE_STATUSES.includes(p.status)).length
  const leadViewings = leads.filter((l) => l.stage === 'viewing').length
  const leadNegotiations = leads.filter((l) => l.stage === 'negotiation').length
  const closedDeals = leads.filter((l) => l.stage === 'closed').length

  let followUpsOverdue = 0
  let followUpsToday = 0
  for (const l of leads) {
    if (l.stage === 'closed' || l.stage === 'lost') continue
    const b = bucketFollowUp(l.next_follow_up_at, now)
    if (b === 'overdue') followUpsOverdue++
    if (b === 'today') followUpsToday++
  }

  const start = startOfLocalDay(now).getTime()
  const upcomingViewings = schedules.filter(
    (s) =>
      !s.completed &&
      s.schedule_type === 'property_viewing' &&
      new Date(s.scheduled_at).getTime() >= start,
  ).length

  const scheduledMarketingPosts = schedules.filter(
    (s) => !s.completed && s.schedule_type === 'marketing_post',
  ).length

  return {
    totalProperties: properties.length,
    activeListings,
    totalLeads: leads.length,
    leadViewings,
    leadNegotiations,
    closedDeals,
    followUpsOverdue,
    followUpsToday,
    upcomingViewings,
    scheduledMarketingPosts,
  }
}
