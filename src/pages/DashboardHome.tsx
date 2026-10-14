import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProperties } from '../hooks/useProperties'
import { useLeads } from '../hooks/useLeads'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { StatusBadge } from '../components/StatusBadge'
import { formatCurrency, formatDate } from '../lib/format'
import { ACTIVE_LEAD_STAGES, ACTIVE_STATUSES, ATTENTION_STATUSES } from '../types/database'

export function DashboardHome() {
  const { user, profile } = useAuth()
  const { properties, loading: propsLoading, error: propsError } = useProperties(user?.id)
  const { leads, loading: leadsLoading, error: leadsError } = useLeads(user?.id)

  if (propsLoading || leadsLoading) return <LoadingSpinner />

  const total = properties.length
  const active = properties.filter((p) => ACTIVE_STATUSES.includes(p.status)).length
  const closed = properties.filter((p) => p.status === 'sold' || p.status === 'rented').length
  const needsAttention = properties.filter((p) => ATTENTION_STATUSES.includes(p.status)).length
  const recent = properties.slice(0, 5)

  const now = Date.now()
  const totalLeads = leads.length
  const newLeads = leads.filter((l) => l.stage === 'new').length
  const activeOpportunities = leads.filter((l) => ACTIVE_LEAD_STAGES.includes(l.stage)).length
  const viewings = leads.filter((l) => l.stage === 'viewing').length
  const followUpsDue = leads.filter(
    (l) =>
      l.next_follow_up_at &&
      new Date(l.next_follow_up_at).getTime() <= now &&
      l.stage !== 'closed' &&
      l.stage !== 'lost',
  ).length

  const error = propsError || leadsError

  return (
    <div>
      <div className="dashboard-hero">
        <div>
          <span className="eyebrow">LISTYAI COMMAND CENTRE</span>
          <h2 className="page-title" style={{ margin: '5px 0 4px' }}>Good day, {profile?.full_name?.split(' ')[0] || 'Agent'}.</h2>
          <p className="muted" style={{ margin: 0 }}>Your property pipeline, leads and next actions at a glance.</p>
        </div>
        <div className="dashboard-actions">
          <Link to="/dashboard/whatsapp" className="btn">Process enquiry</Link>
          <Link to="/dashboard/properties/new" className="btn btn-blue">+ Add property</Link>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <h3 style={{ margin: '0 0 8px', color: 'var(--heading)', fontSize: 15 }}>Properties</h3>
      <div className="kpis">
        <div className="card pad kpi">
          <div className="k">{total}</div>
          <div className="l">Total properties</div>
        </div>
        <div className="card pad kpi">
          <div className="k">{active}</div>
          <div className="l">Active listings</div>
        </div>
        <div className="card pad kpi">
          <div className="k">{closed}</div>
          <div className="l">Sold / rented</div>
        </div>
        <div className="card pad kpi">
          <div className="k">{needsAttention}</div>
          <div className="l">Needs attention</div>
        </div>
      </div>

      <h3 style={{ margin: '16px 0 8px', color: 'var(--heading)', fontSize: 15 }}>Leads</h3>
      <div className="kpis">
        <div className="card pad kpi">
          <div className="k">{totalLeads}</div>
          <div className="l">Total leads</div>
        </div>
        <div className="card pad kpi">
          <div className="k">{newLeads}</div>
          <div className="l">New leads</div>
        </div>
        <div className="card pad kpi">
          <div className="k">{activeOpportunities}</div>
          <div className="l">Active opportunities</div>
        </div>
        <div className="card pad kpi">
          <div className="k">{viewings}</div>
          <div className="l">Viewings</div>
        </div>
        <div className="card pad kpi">
          <div className="k">{followUpsDue}</div>
          <div className="l">Follow-ups due</div>
        </div>
      </div>

      {followUpsDue > 0 && (
        <div className="card pad" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 8px', color: 'var(--heading)' }}>Follow-ups due</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {leads
              .filter(
                (l) =>
                  l.next_follow_up_at &&
                  new Date(l.next_follow_up_at).getTime() <= now &&
                  l.stage !== 'closed' &&
                  l.stage !== 'lost',
              )
              .slice(0, 5)
              .map((l) => (
                <li key={l.id}>
                  <Link to={`/dashboard/leads/${l.id}`} style={{ fontWeight: 700 }}>
                    {l.name}
                  </Link>{' '}
                  <span className="muted">{formatDate(l.next_follow_up_at!)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="card pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: 'var(--heading)' }}>Recent properties</h3>
          <Link to="/dashboard/properties" className="btn btn-ghost" style={{ fontSize: 13 }}>
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <h3>No properties yet</h3>
            <p className="muted">Add your first listing to see stats and recent activity here.</p>
            <Link to="/dashboard/properties/new" className="btn btn-blue">
              Add property
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Location</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link
                        to={`/dashboard/properties/${p.id}`}
                        style={{ fontWeight: 800, color: 'var(--heading)' }}
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td>{p.location}</td>
                    <td>{formatCurrency(Number(p.price), p.listing_type)}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="muted">{formatDate(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {needsAttention > 0 && (
        <div className="card pad" style={{ marginTop: 12 }}>
          <h3 style={{ margin: '0 0 8px', color: 'var(--heading)' }}>Properties needing attention</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Listings in viewing or negotiation — follow up with buyers or tenants.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {properties
              .filter((p) => ATTENTION_STATUSES.includes(p.status))
              .map((p) => (
                <li key={p.id} style={{ marginBottom: 6 }}>
                  <Link to={`/dashboard/properties/${p.id}`} style={{ fontWeight: 700 }}>
                    {p.title}
                  </Link>{' '}
                  <StatusBadge status={p.status} />
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
