import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProperties } from '../hooks/useProperties'
import { useLeads } from '../hooks/useLeads'
import { useSchedules } from '../hooks/useSchedules'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { StatusBadge } from '../components/StatusBadge'
import { FeatureGate } from '../components/FeatureGate'
import { computeAnalytics } from '../lib/analytics'
import { formatCurrency, formatDate } from '../lib/format'
import { canAccessFeature, getPlan, hasActivePlanAccess } from '../lib/plans'
import { LEAD_STAGES, PROPERTY_STATUSES } from '../types/database'

export function AnalyticsPage() {
  const { user, profile } = useAuth()
  const { properties, loading: propertiesLoading, error: propertiesError } = useProperties(user?.id)
  const { leads, loading: leadsLoading, error: leadsError } = useLeads(user?.id)
  const { schedules, loading: schedulesLoading, error: schedulesError } = useSchedules(user?.id)

  if (propertiesLoading || leadsLoading || schedulesLoading) return <LoadingSpinner />

  const error = propertiesError || leadsError || schedulesError
  const plan = getPlan(profile)
  const snapshot = computeAnalytics(properties, leads, schedules)
  const active = properties.filter((p) => ['available', 'viewing', 'negotiation'].includes(p.status))
  const closed = properties.filter((p) => p.status === 'sold' || p.status === 'rented')
  const leadPipeline = LEAD_STAGES.map((stage) => ({ ...stage, count: leads.filter((l) => l.stage === stage.value).length }))
  const propertyPipeline = PROPERTY_STATUSES.map((status) => ({ ...status, count: properties.filter((p) => p.status === status.value).length }))
  const maxLead = Math.max(1, ...leadPipeline.map((x) => x.count))
  const maxProperty = Math.max(1, ...propertyPipeline.map((x) => x.count))
  const upcoming = schedules.filter((s) => !s.completed && new Date(s.scheduled_at).getTime() >= Date.now()).slice(0, 6)
  const recentClosed = closed.slice(0, 5)

  return (
    <div>
      <div className="dashboard-hero">
        <div>
          <span className="eyebrow">PERFORMANCE</span>
          <h2 className="page-title" style={{ margin: '5px 0 3px' }}>Analytics</h2>
          <p className="muted" style={{ margin: 0 }}>Live performance data from your properties, leads and schedule.</p>
        </div>
        <Link to="/dashboard" className="btn btn-ghost">Back to overview</Link>
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="kpis">
        <div className="card pad kpi"><div className="k">{snapshot.totalProperties}</div><div className="l">Total properties</div></div>
        <div className="card pad kpi"><div className="k">{snapshot.activeListings}</div><div className="l">Active listings</div></div>
        <div className="card pad kpi"><div className="k">{snapshot.totalLeads}</div><div className="l">Total leads</div></div>
        <div className="card pad kpi"><div className="k">{snapshot.closedDeals}</div><div className="l">Closed leads</div></div>
        <div className="card pad kpi"><div className="k">{snapshot.followUpsOverdue}</div><div className="l">Overdue follow-ups</div></div>
        <div className="card pad kpi"><div className="k">{snapshot.upcomingViewings}</div><div className="l">Upcoming viewings</div></div>
      </div>

      {hasActivePlanAccess(profile) && canAccessFeature(plan, 'advanced_analytics') ? (
        <>
          <div className="grid-2" style={{ marginTop: 12 }}>
            <section className="card pad">
              <h3 style={{ margin: '0 0 14px', color: 'var(--heading)' }}>Lead pipeline</h3>
              {leadPipeline.map((item) => (
                <div key={item.value} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}><span style={{ fontWeight: 700 }}>{item.label}</span><strong>{item.count}</strong></div>
                  <div className="analytics-bar-track"><div className="analytics-bar" style={{ width: `${(item.count / maxLead) * 100}%` }} /></div>
                </div>
              ))}
            </section>
            <section className="card pad">
              <h3 style={{ margin: '0 0 14px', color: 'var(--heading)' }}>Property pipeline</h3>
              {propertyPipeline.map((item) => (
                <div key={item.value} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}><span style={{ fontWeight: 700 }}>{item.label}</span><strong>{item.count}</strong></div>
                  <div className="analytics-bar-track"><div className="analytics-bar" style={{ width: `${(item.count / maxProperty) * 100}%` }} /></div>
                </div>
              ))}
            </section>
          </div>

          <div className="grid-2" style={{ marginTop: 12 }}>
            <section className="card pad">
              <h3 style={{ margin: '0 0 10px', color: 'var(--heading)' }}>Activity snapshot</h3>
              <div className="analytics-list">
                <div><span>Viewing-stage leads</span><strong>{snapshot.leadViewings}</strong></div>
                <div><span>Negotiation-stage leads</span><strong>{snapshot.leadNegotiations}</strong></div>
                <div><span>Follow-ups due today</span><strong>{snapshot.followUpsToday}</strong></div>
                <div><span>Scheduled marketing posts</span><strong>{snapshot.scheduledMarketingPosts}</strong></div>
              </div>
            </section>
            <section className="card pad">
              <h3 style={{ margin: '0 0 10px', color: 'var(--heading)' }}>Upcoming schedule</h3>
              {upcoming.length === 0 ? <p className="muted">No upcoming items.</p> : <div className="analytics-list">{upcoming.map((item) => <div key={item.id}><span><strong>{item.title}</strong><br /><small className="muted">{formatDate(item.scheduled_at)}</small></span><span className="badge badge-viewing">{item.schedule_type.replace('_', ' ')}</span></div>)}</div>}
            </section>
          </div>

          <section className="card pad" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><h3 style={{ margin: 0, color: 'var(--heading)' }}>Active listings</h3><Link to="/dashboard/properties" className="btn btn-ghost" style={{ fontSize: 13 }}>View all</Link></div>
            {active.length === 0 ? <p className="muted">No active listings.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Property</th><th>Location</th><th>Price</th><th>Status</th></tr></thead><tbody>{active.slice(0, 8).map((p) => <tr key={p.id}><td><Link to={`/dashboard/properties/${p.id}`} style={{ fontWeight: 800, color: 'var(--heading)' }}>{p.title}</Link></td><td>{p.location}</td><td>{formatCurrency(Number(p.price), p.listing_type)}</td><td><StatusBadge status={p.status} /></td></tr>)}</tbody></table></div>}
          </section>

          <section className="card pad" style={{ marginTop: 12 }}>
            <h3 style={{ margin: '0 0 12px', color: 'var(--heading)' }}>Recent closed listings</h3>
            {recentClosed.length === 0 ? <p className="muted">No sold or rented properties yet.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Property</th><th>Price</th><th>Status</th><th>Updated</th></tr></thead><tbody>{recentClosed.map((p) => <tr key={p.id}><td><Link to={`/dashboard/properties/${p.id}`} style={{ fontWeight: 800, color: 'var(--heading)' }}>{p.title}</Link></td><td>{formatCurrency(Number(p.price), p.listing_type)}</td><td><StatusBadge status={p.status} /></td><td className="muted">{formatDate(p.updated_at)}</td></tr>)}</tbody></table></div>}
          </section>
        </>
      ) : (
        <div style={{ marginTop: 12 }}><FeatureGate feature="advanced_analytics" /></div>
      )}
    </div>
  )
}
