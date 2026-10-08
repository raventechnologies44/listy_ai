import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AiOutputBlock } from '../components/AiOutputBlock'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { requestAiGeneration } from '../lib/ai'
import { fromLocalDatetimeInput, toLocalDatetimeInput, bucketFollowUp, type FollowUpBucket } from '../lib/dates'
import { formatDate } from '../lib/format'
import { updateLead, useLeads } from '../hooks/useLeads'
import { canAccessFeature, getPlan } from '../lib/plans'
import { FeatureGate } from '../components/FeatureGate'
import { useProperties } from '../hooks/useProperties'
import { LEAD_STAGES, type LeadStage } from '../types/database'

function bucketLabel(bucket: FollowUpBucket) {
  if (bucket === 'overdue') return 'Overdue'
  if (bucket === 'today') return 'Due today'
  return 'Upcoming'
}

export function FollowUpsPage() {
  const { user, profile } = useAuth()
  const { leads, loading, error, reload } = useLeads(user?.id)
  const { properties } = useProperties(user?.id)
  const plan = getPlan(profile)
  const [actionError, setActionError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [messageLeadId, setMessageLeadId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messageError, setMessageError] = useState<string | null>(null)
  const [messageLoading, setMessageLoading] = useState(false)

  const followUps = useMemo(() => {
    const now = new Date()
    return leads
      .filter((lead) => lead.next_follow_up_at && lead.stage !== 'closed' && lead.stage !== 'lost')
      .map((lead) => ({
        lead,
        bucket: bucketFollowUp(lead.next_follow_up_at, now),
        property: properties.find((p) => p.id === lead.property_id) ?? null,
      }))
      .filter((item) => item.bucket !== null)
      .sort((a, b) => new Date(a.lead.next_follow_up_at!).getTime() - new Date(b.lead.next_follow_up_at!).getTime())
  }, [leads, properties])

  const counts = useMemo(
    () => ({
      overdue: followUps.filter((x) => x.bucket === 'overdue').length,
      today: followUps.filter((x) => x.bucket === 'today').length,
      upcoming: followUps.filter((x) => x.bucket === 'upcoming').length,
    }),
    [followUps],
  )

  async function changeStage(id: string, stage: LeadStage) {
    if (!user) return
    setActionError(null)
    setSavingId(id)
    const result = await updateLead(id, user.id, { stage })
    setSavingId(null)
    if (result.error) setActionError(result.error)
    else await reload()
  }

  async function changeFollowUp(id: string, value: string) {
    if (!user) return
    setActionError(null)
    setSavingId(id)
    const result = await updateLead(id, user.id, { next_follow_up_at: fromLocalDatetimeInput(value) })
    setSavingId(null)
    if (result.error) setActionError(result.error)
    else await reload()
  }

  async function completeFollowUp(id: string) {
    if (!user) return
    setActionError(null)
    setSavingId(id)
    const result = await updateLead(id, user.id, {
      last_contact_at: new Date().toISOString(),
      next_follow_up_at: null,
    })
    setSavingId(null)
    if (result.error) setActionError(result.error)
    else await reload()
  }

  async function generateMessage(leadId: string) {
    if (!canAccessFeature(plan, 'ai_follow_up')) return
    const item = followUps.find((x) => x.lead.id === leadId)
    if (!item) return
    setMessageLeadId(leadId)
    setMessageLoading(true)
    setMessageError(null)
    setMessage('')
    const result = await requestAiGeneration({
      task: 'follow_up',
      lead: item.lead,
      property: item.property ?? undefined,
      agentName: profile?.full_name,
    })
    setMessageLoading(false)
    if (result.error) setMessageError(result.error)
    else setMessage(result.text ?? '')
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Follow-ups</h2>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Keep buyer conversations moving and never miss a scheduled follow-up.
        </p>
      </div>

      {(error || actionError) && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {error || actionError}
        </div>
      )}

      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="card pad kpi"><div className="k">{counts.overdue}</div><div className="l">Overdue</div></div>
        <div className="card pad kpi"><div className="k">{counts.today}</div><div className="l">Due today</div></div>
        <div className="card pad kpi"><div className="k">{counts.upcoming}</div><div className="l">Upcoming</div></div>
      </div>

      {!canAccessFeature(plan, 'ai_follow_up') && (
        <div style={{ marginBottom: 12 }}><FeatureGate feature="ai_follow_up" compact /></div>
      )}

      {followUps.length === 0 ? (
        <div className="card empty-state">
          <h3>No active follow-ups</h3>
          <p className="muted">Set a next follow-up date on a lead and it will appear here.</p>
          <Link to="/dashboard/leads" className="btn btn-blue">View leads</Link>
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Property</th>
                <th>Stage</th>
                <th>Next follow-up</th>
                <th>Last contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {followUps.map(({ lead, bucket, property }) => (
                <tr key={lead.id}>
                  <td>
                    <Link to={`/dashboard/leads/${lead.id}`} style={{ fontWeight: 800, color: 'var(--heading)' }}>
                      {lead.name}
                    </Link>
                    {lead.phone && <div className="muted" style={{ fontSize: 12 }}>{lead.phone}</div>}
                    <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800 }}>
                      {bucket && bucketLabel(bucket)}
                    </div>
                  </td>
                  <td>
                    {property ? (
                      <Link to={`/dashboard/properties/${property.id}`}>{property.title}</Link>
                    ) : '—'}
                  </td>
                  <td>
                    <select
                      className="select"
                      value={lead.stage}
                      disabled={savingId === lead.id}
                      onChange={(e) => void changeStage(lead.id, e.target.value as LeadStage)}
                    >
                      {LEAD_STAGES.map((stage) => (
                        <option key={stage.value} value={stage.value}>{stage.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ minWidth: 210 }}>
                    <input
                      className="input"
                      type="datetime-local"
                      value={toLocalDatetimeInput(lead.next_follow_up_at)}
                      disabled={savingId === lead.id}
                      onChange={(e) => void changeFollowUp(lead.id, e.target.value)}
                    />
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {lead.next_follow_up_at ? formatDate(lead.next_follow_up_at) : '—'}
                    </div>
                  </td>
                  <td className="muted">{lead.last_contact_at ? formatDate(lead.last_contact_at) : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-blue"
                        disabled={savingId === lead.id}
                        onClick={() => void completeFollowUp(lead.id)}
                      >
                        Complete
                      </button>
                      {canAccessFeature(plan, 'ai_follow_up') ? (
                        <button
                          type="button"
                          className="btn"
                          disabled={messageLoading && messageLeadId === lead.id}
                          onClick={() => void generateMessage(lead.id)}
                        >
                          {messageLoading && messageLeadId === lead.id ? 'Generating…' : 'AI message'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {messageLeadId && (
        <div className="card pad" style={{ marginTop: 12 }}>
          <AiOutputBlock
            label="AI follow-up message"
            value={message}
            onChange={setMessage}
            onGenerate={() => void generateMessage(messageLeadId)}
            generating={messageLoading}
            error={messageError}
          />
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Edit, copy and send manually. ListyAI does not automatically send the message.
          </p>
        </div>
      )}
    </div>
  )
}
