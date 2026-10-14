import { FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCurrency, userInitials } from '../lib/format'
import {
  averageRating,
  imageUrl,
  marketAction,
  Stars,
  statusNote,
  whatsappLink,
  type AgentReview,
  type PublishedListing,
} from './marketApi'

const REPORT_REASONS: [string, string][] = [
  ['sold_or_unavailable', 'Already sold / unavailable'],
  ['wrong_price', 'Wrong price'],
  ['fake_or_scam', 'Looks fake or a scam'],
  ['wrong_photos', 'Photos do not match'],
  ['other', 'Other'],
]

export function ListingPage() {
  const { id } = useParams()
  const [listing, setListing] = useState<PublishedListing | null>(null)
  const [reviews, setReviews] = useState<AgentReview[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(0)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('sold_or_unavailable')
  const [reportDone, setReportDone] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      const { data } = await supabase.from('published_listings').select('*').eq('property_id', id).maybeSingle()
      if (cancelled) return
      const row = (data ?? null) as PublishedListing | null
      setListing(row)
      if (row) {
        const { data: rv } = await supabase
          .from('agent_reviews_public')
          .select('*')
          .eq('agent_id', row.agent_id)
        if (!cancelled) setReviews((rv ?? []) as AgentReview[])
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <p className="muted">Loading…</p>

  if (!listing) {
    return (
      <div className="mk-empty">
        <strong style={{ color: 'var(--heading)' }}>This listing is no longer available.</strong>
        <p className="muted">It may have been sold, taken down or expired.</p>
        <Link to="/market" className="btn btn-blue">Browse properties</Link>
      </div>
    )
  }

  const photos = listing.image_paths.map((p) => imageUrl(p)).filter((u): u is string => Boolean(u))
  const wa = whatsappLink(
    listing.agent_phone,
    `Hi, I saw "${listing.title}" on ListyMarket and I'm interested.`,
  )
  const note = statusNote(listing.status)
  const avg = averageRating(reviews)

  async function onEnquire(e: FormEvent) {
    e.preventDefault()
    if (!listing) return
    setError(null)
    setSending(true)
    try {
      await marketAction('enquiry', { listing_id: listing.property_id, name, phone, message, website })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your enquiry.')
    } finally {
      setSending(false)
    }
  }

  async function onReport() {
    if (!listing) return
    setReportError(null)
    try {
      await marketAction('report', { listing_id: listing.property_id, reason })
      setReportDone(true)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Could not send report.')
    }
  }

  return (
    <div>
      <Link to="/market" className="muted" style={{ fontWeight: 700, fontSize: 13 }}>← All properties</Link>
      <div className="mk-detail" style={{ marginTop: 12 }}>
        <div style={{ display: 'grid', gap: 14 }}>
          {photos.length > 0 ? (
            <div>
              <img className="mk-gallery-main" src={photos[Math.min(active, photos.length - 1)]} alt={listing.title} />
              {photos.length > 1 && (
                <div className="mk-thumbs">
                  {photos.map((u, i) => (
                    <img key={u} src={u} alt="" className={i === active ? 'on' : ''} onClick={() => setActive(i)} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mk-gallery-main" style={{ display: 'grid', placeItems: 'center' }}>No photos</div>
          )}

          <div className="mk-box">
            <div>
              <div className="mk-price" style={{ fontSize: 28 }}>{formatCurrency(Number(listing.price), listing.listing_type)}</div>
              <h2 style={{ margin: '4px 0', color: 'var(--heading)' }}>{listing.title}</h2>
              <div className="muted" style={{ fontWeight: 700 }}>{listing.location}{note ? ` · ${note}` : ''}</div>
            </div>
            <div className="mk-facts">
              <div><small>TYPE</small><b>{listing.property_type}</b></div>
              <div><small>LISTING</small><b>{listing.listing_type === 'rent' ? 'For rent' : 'For sale'}</b></div>
              {listing.bedrooms != null && <div><small>BEDS</small><b>{listing.bedrooms}</b></div>}
              {listing.bathrooms != null && <div><small>BATHS</small><b>{listing.bathrooms}</b></div>}
              {listing.size != null && <div><small>SIZE</small><b>{listing.size} sq ft</b></div>}
            </div>
            {listing.description && <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{listing.description}</p>}
            {listing.features.length > 0 && (
              <div className="mk-chips">{listing.features.map((f) => <span key={f} className="mk-chip">{f}</span>)}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="mk-box">
            <div className="mk-agent">
              <div className="mk-avatar">{userInitials(listing.agent_name)}</div>
              <div>
                <strong style={{ color: 'var(--heading)' }}>{listing.agent_name || 'Agent'}</strong>
                <div className="mk-meta">{listing.agent_brokerage || 'Real estate agent'}</div>
              </div>
            </div>
            <Link to={`/market/agent/${listing.agent_id}`} style={{ fontSize: 13, fontWeight: 700 }}>
              {reviews.length > 0 ? <><Stars value={avg} /> {avg.toFixed(1)} ({reviews.length}) · See reviews</> : 'No reviews yet · View agent'}
            </Link>
            {wa && (
              <a className="btn mk-wa btn-lg" href={wa} target="_blank" rel="noreferrer">Chat on WhatsApp</a>
            )}
          </div>

          <form className="mk-box" onSubmit={(e) => void onEnquire(e)}>
            <h3>Send an enquiry</h3>
            {sent ? (
              <div className="mk-ok">Enquiry sent. The agent will contact you on the number you gave.</div>
            ) : (
              <>
                <input className="input" placeholder="Your name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
                <input className="input" placeholder="Phone / WhatsApp number" inputMode="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} required />
                <textarea className="textarea" placeholder="Message (optional), e.g. I'd like to view this weekend." value={message} maxLength={600} onChange={(e) => setMessage(e.target.value)} />
                <input className="mk-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
                {error && <div className="mk-err">{error}</div>}
                <button type="submit" className="btn btn-blue" disabled={sending}>{sending ? 'Sending…' : 'Send enquiry'}</button>
                <p className="mk-note">Your details go only to this agent.</p>
              </>
            )}
          </form>

          <div style={{ padding: '0 4px' }}>
            {reportDone ? (
              <p className="mk-note">Thanks. We have recorded your report.</p>
            ) : reporting ? (
              <div className="mk-box">
                <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
                  {REPORT_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {reportError && <div className="mk-err">{reportError}</div>}
                <button type="button" className="btn btn-danger" onClick={() => void onReport()}>Report listing</button>
              </div>
            ) : (
              <button type="button" className="mk-link-btn" onClick={() => setReporting(true)}>Report this listing</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
