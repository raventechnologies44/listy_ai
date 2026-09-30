import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createLead, updateLead, useLead } from '../hooks/useLeads'
import { useProperties } from '../hooks/useProperties'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { LEAD_STAGES, type LeadStage } from '../types/database'

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const empty = {
  name: '',
  phone: '',
  email: '',
  budget: '',
  requirements: '',
  notes: '',
  stage: 'new' as LeadStage,
  property_id: '',
  last_contact_at: '',
  next_follow_up_at: '',
}

export function LeadFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lead, loading, error: loadError } = useLead(id, user?.id)
  const { properties } = useProperties(user?.id)
  const [form, setForm] = useState(empty)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!lead) return
    setForm({
      name: lead.name,
      phone: lead.phone ?? '',
      email: lead.email ?? '',
      budget: lead.budget != null ? String(lead.budget) : '',
      requirements: lead.requirements ?? '',
      notes: lead.notes ?? '',
      stage: lead.stage,
      property_id: lead.property_id ?? '',
      last_contact_at: toLocalInput(lead.last_contact_at),
      next_follow_up_at: toLocalInput(lead.next_follow_up_at),
    })
  }, [lead])

  if (isEdit && loading) return <LoadingSpinner />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setSubmitting(true)

    if (!form.name.trim()) {
      setSubmitting(false)
      setError('Name is required.')
      return
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      budget: form.budget ? Number(form.budget) : null,
      requirements: form.requirements.trim() || null,
      notes: form.notes.trim() || null,
      stage: form.stage,
      property_id: form.property_id || null,
      last_contact_at: fromLocalInput(form.last_contact_at),
      next_follow_up_at: fromLocalInput(form.next_follow_up_at),
    }

    if (isEdit && id) {
      const { error: err } = await updateLead(id, user.id, payload)
      setSubmitting(false)
      if (err) {
        setError(err)
        return
      }
      navigate(`/dashboard/leads/${id}`)
      return
    }

    const { data, error: err } = await createLead(user.id, payload)
    setSubmitting(false)
    if (err || !data) {
      setError(err ?? 'Could not create lead')
      return
    }
    navigate(`/dashboard/leads/${data.id}`)
  }

  return (
    <div>
      <Link to={isEdit && id ? `/dashboard/leads/${id}` : '/dashboard/leads'} className="muted" style={{ fontWeight: 700, fontSize: 13 }}>
        ← Back
      </Link>
      <h2 className="page-title" style={{ margin: '8px 0 12px' }}>
        {isEdit ? 'Edit lead' : 'Add lead'}
      </h2>

      {(error || loadError) && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {error ?? loadError}
        </div>
      )}

      <form className="card pad" onSubmit={(e) => void onSubmit(e)}>
        <div className="form-grid">
          <div className="field">
            <label className="label" htmlFor="name">
              Name *
            </label>
            <input id="name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="stage">
              Stage
            </label>
            <select id="stage" className="select" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as LeadStage })}>
              {LEAD_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input id="phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="budget">
              Budget (USD)
            </label>
            <input id="budget" type="number" min={0} className="input" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="property_id">
              Linked property
            </label>
            <select id="property_id" className="select" value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}>
              <option value="">None</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} — {p.location}
                </option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label className="label" htmlFor="requirements">
              Requirements
            </label>
            <textarea id="requirements" className="textarea" rows={3} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
          </div>
          <div className="field full">
            <label className="label" htmlFor="notes">
              Notes
            </label>
            <textarea id="notes" className="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="last_contact">
              Last contact
            </label>
            <input id="last_contact" type="datetime-local" className="input" value={form.last_contact_at} onChange={(e) => setForm({ ...form, last_contact_at: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="next_follow_up">
              Next follow-up
            </label>
            <input id="next_follow_up" type="datetime-local" className="input" value={form.next_follow_up_at} onChange={(e) => setForm({ ...form, next_follow_up_at: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="submit" className="btn btn-blue" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save' : 'Create lead'}
          </button>
          <Link to="/dashboard/leads" className="btn">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
