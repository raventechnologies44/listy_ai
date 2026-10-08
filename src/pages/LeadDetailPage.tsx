import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AiOutputBlock } from '../components/AiOutputBlock'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { requestAiGeneration } from '../lib/ai'
import { formatCurrency, formatDate } from '../lib/format'
import { matchLeadToProperties } from '../lib/matching'
import { deleteLead, updateLead, useLead } from '../hooks/useLeads'
import { useProperties } from '../hooks/useProperties'
import { LEAD_STAGES, type LeadStage } from '../types/database'

export function LeadDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { lead, loading, error, reload } = useLead(id, user?.id)
  const { properties } = useProperties(user?.id)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [followUpText, setFollowUpText] = useState('')
  const [followUpError, setFollowUpError] = useState<string | null>(null)
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const linkedProperty = useMemo(
    () => properties.find((p) => p.id === lead?.property_id) ?? null,
    [properties, lead?.property_id],
  )

  const matches = useMemo(() => {
    if (!lead) return []
    return matchLeadToProperties(lead, properties)
  }, [lead, properties])

  useEffect(() => {
    if (lead?.notes) setNotes(lead.notes)
  }, [lead?.notes])

  if (loading) return <LoadingSpinner />

  if (!lead) {
    return (
      <div className="card pad empty-state">
        <h3>{error ? 'Could not load lead' : 'Lead not found'}</h3>
        {error && <p className="error-banner">{error}</p>}
        <Link to="/dashboard/leads" className="btn">
          Back to leads
        </Link>
      </div>
    )
  }

  async function onStageChange(stage: LeadStage) {
    if (!user || !id) return
    setActionError(null)
    const { error: err } = await updateLead(id, user.id, { stage })
    if (err) setActionError(err)
    else await reload()
  }

  async function saveNotes() {
    if (!user || !id) return
    setNotesSaving(true)
    setActionError(null)
    const { error: err } = await updateLead(id, user.id, { notes: notes.trim() || null })
    setNotesSaving(false)
    if (err) setActionError(err)
    else await reload()
  }

  async function generateFollowUp() {
    if (!lead) return
    setFollowUpLoading(true)
    setFollowUpError(null)
    const { text, error: err } = await requestAiGeneration({
      task: 'follow_up',
      lead,
      property: linkedProperty ?? undefined,
      agentName: profile?.full_name,
    })
    setFollowUpLoading(false)
    if (err) setFollowUpError(err)
    else if (text) setFollowUpText(text)
  }

  async function onDelete() {
    if (!user || !id) return
    if (!window.confirm('Delete this lead?')) return
    setDeleting(true)
    const { error: err } = await deleteLead(id, user.id)
    setDeleting(false)
    if (err) setActionError(err)
    else navigate('/dashboard/leads')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div>
          <Link to="/dashboard/leads" className="muted" style={{ fontWeight: 700, fontSize: 13 }}>
            ← Leads
          </Link>
          <h2 className="page-title" style={{ margin: '8px 0 4px' }}>
            {lead.name}
          </h2>
          <span className="badge badge-viewing" style={{ textTransform: 'capitalize' }}>
            {lead.stage}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`/dashboard/leads/${lead.id}/edit`} className="btn">
            Edit
          </Link>
          <button type="button" className="btn btn-danger" disabled={deleting} onClick={() => void onDelete()}>
            Delete
          </button>
        </div>
      </div>

      {actionError && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {actionError}
        </div>
      )}

      <div className="card pad" style={{ marginBottom: 12 }}>
        <div className="form-grid">
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Phone
            </div>
            <div>{lead.phone || '—'}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Email
            </div>
            <div>{lead.email || '—'}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Budget
            </div>
            <div>{lead.budget != null ? formatCurrency(Number(lead.budget), 'sale') : '—'}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Stage
            </div>
            <select className="select" value={lead.stage} onChange={(e) => void onStageChange(e.target.value as LeadStage)}>
              {LEAD_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {lead.requirements && (
          <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
            <strong style={{ color: 'var(--heading)' }}>Requirements:</strong> {lead.requirements}
          </p>
        )}
        {linkedProperty && (
          <p style={{ marginTop: 12, marginBottom: 0 }}>
            <strong>Linked property:</strong>{' '}
            <Link to={`/dashboard/properties/${linkedProperty.id}`}>{linkedProperty.title}</Link>
          </p>
        )}
        <p className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>
          Last contact: {lead.last_contact_at ? formatDate(lead.last_contact_at) : '—'} · Next follow-up:{' '}
          {lead.next_follow_up_at ? formatDate(lead.next_follow_up_at) : '—'}
        </p>
      </div>

      <div className="card pad" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 8px', color: 'var(--heading)' }}>Notes</h3>
        <textarea className="textarea" rows={4} value={notes || lead.notes || ''} onChange={(e) => setNotes(e.target.value)} />
        <button type="button" className="btn btn-blue" style={{ marginTop: 8 }} disabled={notesSaving} onClick={() => void saveNotes()}>
          {notesSaving ? 'Saving…' : 'Save notes'}
        </button>
      </div>

      <div className="card pad" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 4px', color: 'var(--heading)' }}>Potential property matches</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Based on your listings and this lead&apos;s budget, requirements, and linked property. Not a guarantee — review each match.
        </p>
        {matches.length === 0 ? (
          <p className="muted">No strong matches among active listings. Add requirements or budget to improve suggestions.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {matches.map((m) => (
              <li key={m.property.id} style={{ marginBottom: 12 }}>
                <Link to={`/dashboard/properties/${m.property.id}`} style={{ fontWeight: 800 }}>
                  {m.property.title}
                </Link>{' '}
                <span className="muted">(score {m.score})</span>
                <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                  {m.reasons.map((r) => (
                    <li key={r} className="muted" style={{ fontSize: 13 }}>
                      {r}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card pad">
        <AiOutputBlock
          label="AI follow-up message"
          value={followUpText}
          onChange={setFollowUpText}
          onGenerate={() => void generateFollowUp()}
          generating={followUpLoading}
          error={followUpError}
        />
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Copy and send manually — nothing is sent automatically.
        </p>
      </div>
    </div>
  )
}
