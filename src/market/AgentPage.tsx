import { FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { userInitials } from '../lib/format'
import { ListingCard } from './ListingCard'
import {
  averageRating,
  marketAction,
  Stars,
  whatsappLink,
  type AgentReview,
  type PublishedListing,
} from './marketApi'

export function AgentPage() {
  const { id } = useParams()
  const [listings, setListings] = useState<PublishedListing[]>([])
  const [reviews, setReviews] = useState<AgentReview[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    const [l, r] = await Promise.all([
      supabase.from('published_listings').select('*').eq('agent_id', id).order('published_at', { ascending: false }),
      supabase.from('agent_reviews_public').select('*').eq('agent_id', id).order('created_at', { ascending: false }),
    ])
    setListings((l.data ?? []) as PublishedListing[])
    setReviews((r.data ?? []) as AgentReview[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <p className="muted">Loading…</p>

  const first = listings[0]
  if (!first && reviews.length === 0) {
    return (
      <div className="mk-empty">
        <strong style={{ color: 'var(--heading)' }}>Agent not found.</strong>
        <p><Link to="/market" className="btn btn-blue">Browse properties</Link></p>
      </div>
    )
  }

  const avg = averageRating(reviews)
  const wa = whatsappLink(first?.agent_phone, 'Hi, I found you on ListyMarket.')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    if (rating < 1) {
      setError('Choose a star rating.')
      return
    }
    setError(null)
    setSending(true)
    try {
      await marketAction('review', { agent_id: id, name, phone, rating, comment, website })
      setDone(true)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your review.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <Link to="/market" className="muted" style={{ fontWeight: 700, fontSize: 13 }}>← All properties</Link>
      <div className="mk-box" style={{ margin: '12px 0 18px' }}>
        <div className="mk-agent">
          <div className="mk-avatar">{userInitials(first?.agent_name)}</div>
          <div>
            <h2 style={{ margin: 0, color: 'var(--heading)' }}>{first?.agent_name || 'Agent'}</h2>
            <div className="mk-meta">{first?.agent_brokerage || 'Real estate agent'}</div>
          </div>
        </div>
        <div>
          {reviews.length > 0 ? (
            <><Stars value={avg} /> <strong style={{ color: 'var(--heading)' }}>{avg.toFixed(1)}</strong> <span className="muted">({reviews.length} review{reviews.length === 1 ? '' : 's'})</span></>
          ) : (
            <span className="muted">No reviews yet</span>
          )}
        </div>
        {wa && <a className="btn mk-wa" href={wa} target="_blank" rel="noreferrer" style={{ justifySelf: 'start' }}>Chat on WhatsApp</a>}
      </div>

      <div className="mk-detail">
        <div>
          <h3 style={{ color: 'var(--heading)', margin: '0 0 10px' }}>Reviews</h3>
          <div className="mk-box">
            {reviews.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No reviews yet.</p>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="mk-review">
                  <Stars value={r.rating} /> <strong style={{ color: 'var(--heading)' }}>{r.reviewer_name}</strong>
                  <span className="muted" style={{ fontSize: 12 }}> · {new Date(r.created_at).toLocaleDateString()}</span>
                  {r.comment && <p style={{ margin: '4px 0 0' }}>{r.comment}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        <form className="mk-box" onSubmit={(e) => void onSubmit(e)}>
          <h3>Leave a review</h3>
          <p className="mk-note">Only people who sent this agent an enquiry through ListyMarket can review. Use the phone number from your enquiry.</p>
          {done ? (
            <div className="mk-ok">Thank you. Your review is live.</div>
          ) : (
            <>
              <div className="mk-star-pick" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className={n <= rating ? 'on' : ''} onClick={() => setRating(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`}>★</button>
                ))}
              </div>
              <input className="input" placeholder="Your name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
              <input className="input" placeholder="Phone number used in your enquiry" inputMode="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} required />
              <textarea className="textarea" placeholder="How was your experience? (optional)" value={comment} maxLength={600} onChange={(e) => setComment(e.target.value)} />
              <input className="mk-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
              {error && <div className="mk-err">{error}</div>}
              <button type="submit" className="btn btn-blue" disabled={sending}>{sending ? 'Posting…' : 'Post review'}</button>
            </>
          )}
        </form>
      </div>

      {listings.length > 0 && (
        <>
          <h3 style={{ color: 'var(--heading)', margin: '24px 0 10px' }}>Live listings</h3>
          <div className="mk-grid">
            {listings.filter((l) => new Date(l.expires_at) > new Date() && !l.flagged).map((l) => (
              <ListingCard key={l.property_id} id={l.property_id} title={l.title} price={l.price} location={l.location} listingType={l.listing_type} bedrooms={l.bedrooms} imagePath={l.image_paths[0] ?? null} status={l.status} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
