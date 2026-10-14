import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLeads } from '../hooks/useLeads'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { formatCurrency, formatDate } from '../lib/format'
import { LEAD_STAGES, type LeadStage } from '../types/database'

export function LeadsPage() {
  const { user } = useAuth()
  const { leads, loading, error } = useLeads(user?.id)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<LeadStage | ''>('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (stageFilter && l.stage !== stageFilter) return false
      if (!q) return true
      return (
        l.name.toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q) ||
        (l.phone ?? '').includes(q) ||
        (l.requirements ?? '').toLowerCase().includes(q) ||
        (l.notes ?? '').toLowerCase().includes(q)
      )
    })
  }, [leads, search, stageFilter])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <h2 className="page-title" style={{ margin: 0 }}>
          Leads
        </h2>
        <Link to="/dashboard/leads/new" className="btn btn-blue">
          Add lead
        </Link>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="card pad filters">
        <div className="field">
          <label className="label" htmlFor="lead-search">
            Search
          </label>
          <input
            id="lead-search"
            className="input"
            placeholder="Name, email, phone, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="lead-stage">
            Stage
          </label>
          <select
            id="lead-stage"
            className="select"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as LeadStage | '')}
          >
            <option value="">All stages</option>
            {LEAD_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card empty-state">
          <h3>{leads.length === 0 ? 'No leads yet' : 'No matches'}</h3>
          <p className="muted">
            {leads.length === 0 ? 'Add a lead to track buyers and follow-ups.' : 'Adjust search or filters.'}
          </p>
          {leads.length === 0 && (
            <Link to="/dashboard/leads/new" className="btn btn-blue">
              Add lead
            </Link>
          )}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Stage</th>
                <th>Budget</th>
                <th>Follow-up</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 800, color: 'var(--heading)' }}>{l.name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{l.stage}</td>
                  <td>{l.budget != null ? formatCurrency(Number(l.budget), 'sale') : '—'}</td>
                  <td className="muted">{l.next_follow_up_at ? formatDate(l.next_follow_up_at) : '—'}</td>
                  <td>
                    <Link to={`/dashboard/leads/${l.id}`} className="btn btn-ghost" style={{ fontSize: 13 }}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
