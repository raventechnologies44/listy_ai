import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { useLeads } from '../hooks/useLeads'
import { useProperties } from '../hooks/useProperties'
import { createSchedule, deleteSchedule, updateSchedule, useSchedules } from '../hooks/useSchedules'
import { formatDate } from '../lib/format'
import { fromLocalDatetimeInput, toLocalDatetimeInput } from '../lib/dates'
import { SCHEDULE_TYPES, type ScheduleType } from '../types/database'
import { canAccessFeature, getPlan } from '../lib/plans'
import { FeatureGate } from '../components/FeatureGate'

const emptyForm = {
  schedule_type: 'property_viewing' as ScheduleType,
  title: '',
  notes: '',
  scheduled_at: '',
  property_id: '',
  lead_id: '',
}

function typeLabel(type: ScheduleType) {
  return SCHEDULE_TYPES.find((item) => item.value === type)?.label ?? type
}

export function SchedulingPage() {
  const { user, profile } = useAuth()
  const plan = getPlan(profile)
  const { schedules, loading, error, reload } = useSchedules(user?.id)
  const { properties } = useProperties(user?.id)
  const { leads } = useLeads(user?.id)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | ScheduleType>('all')

  const propertyMap = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties])
  const leadMap = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads])

  const visibleSchedules = useMemo(() => {
    return schedules
      .filter((schedule) => filter === 'all' || schedule.schedule_type === filter)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  }, [schedules, filter])

  const stats = useMemo(() => {
    const active = schedules.filter((s) => !s.completed)
    return {
      total: active.length,
      viewings: active.filter((s) => s.schedule_type === 'property_viewing').length,
      followUps: active.filter((s) => s.schedule_type === 'follow_up_task').length,
      marketing: active.filter((s) => s.schedule_type === 'marketing_post').length,
    }
  }, [schedules])

  function updateForm<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function openNewForm() {
    setActionError(null)
    setForm({
      ...emptyForm,
      scheduled_at: toLocalDatetimeInput(new Date(Date.now() + 60 * 60 * 1000).toISOString()),
    })
    setShowForm(true)
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return
    setActionError(null)
    if (form.schedule_type === 'marketing_post' && !canAccessFeature(plan, 'scheduled_campaigns')) {
      setActionError('Scheduled marketing campaigns are available on Professional and Agency plans.')
      return
    }
    if (!form.title.trim()) {
      setActionError('Enter a title for this schedule.')
      return
    }
    if (!form.scheduled_at) {
      setActionError('Choose a date and time.')
      return
    }

    setSaving(true)
    const result = await createSchedule(user.id, {
      schedule_type: form.schedule_type,
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      scheduled_at: fromLocalDatetimeInput(form.scheduled_at)!,
      property_id: form.property_id || null,
      lead_id: form.lead_id || null,
      completed: false,
    })
    setSaving(false)

    if (result.error) {
      setActionError(result.error)
      return
    }

    setForm(emptyForm)
    setShowForm(false)
    await reload()
  }

  async function toggleComplete(id: string, completed: boolean) {
    if (!user) return
    setActionError(null)
    setActionId(id)
    const result = await updateSchedule(id, user.id, { completed: !completed })
    setActionId(null)
    if (result.error) setActionError(result.error)
    else await reload()
  }

  async function removeSchedule(id: string) {
    if (!user) return
    if (!window.confirm('Delete this scheduled item?')) return
    setActionError(null)
    setActionId(id)
    const result = await deleteSchedule(id, user.id)
    setActionId(null)
    if (result.error) setActionError(result.error)
    else await reload()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Scheduling</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Plan property viewings, follow-up tasks and marketing posts in one place.
          </p>
        </div>
        <button type="button" className="btn btn-blue" onClick={openNewForm}>+ Schedule</button>
      </div>

      {(error || actionError) && <div className="error-banner" style={{ marginBottom: 12 }}>{error || actionError}</div>}

      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="card pad kpi"><div className="k">{stats.total}</div><div className="l">Active scheduled</div></div>
        <div className="card pad kpi"><div className="k">{stats.viewings}</div><div className="l">Viewings</div></div>
        <div className="card pad kpi"><div className="k">{stats.followUps}</div><div className="l">Follow-up tasks</div></div>
        <div className="card pad kpi"><div className="k">{stats.marketing}</div><div className="l">Marketing posts</div></div>
      </div>

      {!canAccessFeature(plan, 'scheduled_campaigns') && (
        <div style={{ marginBottom: 12 }}><FeatureGate feature="scheduled_campaigns" compact /></div>
      )}

      {showForm && (
        <form className="card pad" style={{ marginBottom: 12 }} onSubmit={(e) => void handleCreate(e)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: 'var(--heading)' }}>New schedule</h3>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>

          <div className="form-grid">
            <div className="field">
              <label className="label" htmlFor="schedule-type">Type</label>
              <select id="schedule-type" className="select" value={form.schedule_type} onChange={(e) => updateForm('schedule_type', e.target.value as ScheduleType)}>
                {SCHEDULE_TYPES.map((type) => <option key={type.value} value={type.value} disabled={type.value === 'marketing_post' && !canAccessFeature(plan, 'scheduled_campaigns')}>{type.label}{type.value === 'marketing_post' && !canAccessFeature(plan, 'scheduled_campaigns') ? ' · Professional' : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="schedule-title">Title</label>
              <input id="schedule-title" className="input" value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="e.g. Viewing with Tinashe" required />
            </div>
            <div className="field">
              <label className="label" htmlFor="schedule-date">Date & time</label>
              <input id="schedule-date" className="input" type="datetime-local" value={form.scheduled_at} onChange={(e) => updateForm('scheduled_at', e.target.value)} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="schedule-property">Property</label>
              <select id="schedule-property" className="select" value={form.property_id} onChange={(e) => updateForm('property_id', e.target.value)}>
                <option value="">No property linked</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="schedule-lead">Lead</label>
              <select id="schedule-lead" className="select" value={form.lead_id} onChange={(e) => updateForm('lead_id', e.target.value)}>
                <option value="">No lead linked</option>
                {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
              </select>
            </div>
            <div className="field full">
              <label className="label" htmlFor="schedule-notes">Notes</label>
              <textarea id="schedule-notes" className="textarea" rows={3} value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} placeholder="Optional details" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" className="btn btn-blue" disabled={saving}>{saving ? 'Saving…' : 'Save schedule'}</button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card pad" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className={`btn ${filter === 'all' ? 'btn-blue' : ''}`} onClick={() => setFilter('all')}>All</button>
          {SCHEDULE_TYPES.map((type) => (
            <button key={type.value} type="button" className={`btn ${filter === type.value ? 'btn-blue' : ''}`} disabled={type.value === 'marketing_post' && !canAccessFeature(plan, 'scheduled_campaigns')} onClick={() => setFilter(type.value)}>
              {type.label}{type.value === 'marketing_post' && !canAccessFeature(plan, 'scheduled_campaigns') ? ' · Pro' : ''}
            </button>
          ))}
        </div>
      </div>

      {visibleSchedules.length === 0 ? (
        <div className="card empty-state">
          <h3>No scheduled items</h3>
          <p className="muted">Create a viewing, follow-up task or marketing post to start planning your work.</p>
          <button type="button" className="btn btn-blue" onClick={openNewForm}>Create schedule</button>
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Title</th>
                <th>Property</th>
                <th>Lead</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleSchedules.map((schedule) => {
                const property = schedule.property_id ? propertyMap.get(schedule.property_id) : null
                const lead = schedule.lead_id ? leadMap.get(schedule.lead_id) : null
                const busy = actionId === schedule.id
                return (
                  <tr key={schedule.id}>
                    <td style={{ minWidth: 170 }}>{formatDate(schedule.scheduled_at)}</td>
                    <td><span className="badge">{typeLabel(schedule.schedule_type)}</span></td>
                    <td>
                      <div style={{ fontWeight: 800, color: 'var(--heading)' }}>{schedule.title}</div>
                      {schedule.notes && <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{schedule.notes}</div>}
                    </td>
                    <td>{property ? <Link to={`/dashboard/properties/${property.id}`}>{property.title}</Link> : '—'}</td>
                    <td>{lead ? <Link to={`/dashboard/leads/${lead.id}`}>{lead.name}</Link> : '—'}</td>
                    <td>{schedule.completed ? <span className="badge" style={{ color: 'var(--success)' }}>Completed</span> : <span className="badge">Scheduled</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-blue" disabled={busy} onClick={() => void toggleComplete(schedule.id, schedule.completed)}>
                          {busy ? 'Saving…' : schedule.completed ? 'Reopen' : 'Complete'}
                        </button>
                        <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void removeSchedule(schedule.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="info-banner" style={{ marginTop: 12 }}>
        Scheduling currently records tasks in ListyAI. Marketing posts are scheduled for planning only — ListyAI does not automatically publish them.
      </div>
    </div>
  )
}
