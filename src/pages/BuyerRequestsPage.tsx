import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/format'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { whatsappLink } from '../market/marketApi'

interface Parsed {
  location?: string | null
  budget_max?: number | null
  property_type?: string | null
  listing_type?: 'sale' | 'rent'
  bedrooms?: number | null
}

interface Row {
  id: string
  request_id: string
  match_score: number
  matched_property_ids: string[]
  status: 'new' | 'converted' | 'dismissed'
  lead_id: string | null
  created_at: string
  request: { name: string; phone: string; raw_text: string; parsed: Parsed } | null
}

export function BuyerRequestsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('buyer_request_recipients')
      .select('*, request:buyer_requests(name, phone, raw_text, parsed)')
      .eq('agent_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    const list = (data ?? []) as Row[]
    setRows(list)
    const ids = [...new Set(list.flatMap((r) => r.matched_property_ids))]
    if (ids.length > 0) {
      const { data: props } = await supabase.from('properties').select('id, title').in('id', ids)
      setTitles(Object.fromEntries((props ?? []).map((p) => [p.id as string, p.title as string])))
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function addAsLead(row: Row) {
    if (!user || !row.request) return
    setBusyId(row.id)
    setError(null)
    const p = row.request.parsed ?? {}
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        agent_id: user.id,
        property_id: row.matched_property_ids[0] ?? null,
        name: row.request.name,
        phone: row.request.phone,
        email: null,
        budget: p.budget_max ?? null,
        requirements: row.request.raw_text,
        notes: 'Source: ListyMarket buyer request',
        stage: 'new',
        last_contact_at: null,
        next_follow_up_at: null,
      })
      .select('id')
      .single()
    if (leadErr || !lead) {
      setBusyId(null)
      setError(leadErr?.message ?? 'Could not create lead')
      return
    }
    const { error: upErr } = await supabase
      .from('buyer_request_recipients')
      .update({ status: 'converted', lead_id: lead.id })
      .eq('id', row.id)
    setBusyId(null)
    if (upErr) setError(upErr.message)
    await load()
  }

  async function dismiss(row: Row) {
    setBusyId(row.id)
    const { error: upErr } = await supabase
      .from('buyer_request_recipients')
      .update({ status: 'dismissed' })
      .eq('id', row.id)
    setBusyId(null)
    if (upErr) setError(upErr.message)
    await load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h2 className="page-title" style={{ margin: '0 0 6px' }}>Buyer requests</h2>
      <p className="muted" style={{ margin: '0 0 16px' }}>
        Requests from ListyMarket customers matched to your published listings. Add the good ones to your leads.
      </p>
      {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}

      {rows.length === 0 ? (
        <div className="card pad empty-state">
          <h3>No buyer requests yet</h3>
          <p className="muted">Publish your properties to ListyMarket. When customers send requests that fit, they appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((r) => {
            const req = r.request
            if (!req) return null
            const p = req.parsed ?? {}
            const wa = whatsappLink(req.phone, `Hi ${req.name}, I'm following up on your property request on ListyMarket.`)
            return (
              <div className="card pad" key={r.id} style={r.status !== 'new' ? { opacity: 0.7 } : undefined}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ color: 'var(--heading)' }}>{req.name}</strong>
                    <span className="muted"> · {req.phone} · {formatDate(r.created_at)}</span>
                  </div>
                  <span className={`badge ${r.status === 'new' ? 'badge-available' : 'badge-sold'}`}>
                    {r.status === 'new' ? (r.match_score > 0 ? `Match ${r.match_score}` : 'Open request') : r.status}
                  </span>
                </div>
                <p style={{ margin: '10px 0' }}>{req.raw_text}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {p.listing_type && <span className="badge badge-viewing">{p.listing_type === 'rent' ? 'Rent' : 'Buy'}</span>}
                  {p.location && <span className="badge badge-viewing">{p.location}</span>}
                  {p.property_type && <span className="badge badge-viewing">{p.property_type}</span>}
                  {p.bedrooms != null && <span className="badge badge-viewing">{p.bedrooms} bed</span>}
                  {p.budget_max ? <span className="badge badge-viewing">Up to {formatCurrency(p.budget_max, 'sale')}</span> : null}
                </div>
                {r.matched_property_ids.length > 0 && (
                  <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                    Fits your listings: {r.matched_property_ids.map((id) => titles[id] ?? 'Listing').join(', ')}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.status === 'new' && (
                    <button type="button" className="btn btn-blue btn-sm" disabled={busyId === r.id} onClick={() => void addAsLead(r)}>Add as lead</button>
                  )}
                  {wa && <a className="btn btn-sm" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
                  {r.status === 'new' && (
                    <button type="button" className="btn btn-sm" disabled={busyId === r.id} onClick={() => void dismiss(r)}>Dismiss</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
