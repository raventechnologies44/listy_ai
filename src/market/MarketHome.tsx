import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/format'
import { PROPERTY_TYPES } from '../types/database'
import { ListingCard } from './ListingCard'
import { marketAction, type PublishedListing, type RequestResult } from './marketApi'

export function MarketHome() {
  const [listings, setListings] = useState<PublishedListing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [location, setLocation] = useState('')
  const [type, setType] = useState('')
  const [listingType, setListingType] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [beds, setBeds] = useState('')

  const [reqText, setReqText] = useState('')
  const [reqName, setReqName] = useState('')
  const [reqPhone, setReqPhone] = useState('')
  const [reqWebsite, setReqWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [reqError, setReqError] = useState<string | null>(null)
  const [result, setResult] = useState<RequestResult | null>(null)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      setLoadError(null)
      let q = supabase.from('published_listings').select('*').order('published_at', { ascending: false }).limit(60)
      if (location.trim()) q = q.ilike('location', `%${location.trim().replace(/[%,]/g, '')}%`)
      if (type) q = q.eq('property_type', type)
      if (listingType) q = q.eq('listing_type', listingType)
      if (Number(maxPrice) > 0) q = q.lte('price', Number(maxPrice))
      if (Number(beds) > 0) q = q.gte('bedrooms', Number(beds))
      const { data, error } = await q
      if (cancelled) return
      setLoading(false)
      if (error) {
        setLoadError(error.message)
        setListings([])
        return
      }
      setListings((data ?? []) as PublishedListing[])
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [location, type, listingType, maxPrice, beds])

  async function onSend(e: FormEvent) {
    e.preventDefault()
    setReqError(null)
    setSending(true)
    try {
      const r = await marketAction<RequestResult>('request', {
        text: reqText,
        name: reqName,
        phone: reqPhone,
        website: reqWebsite,
      })
      setResult(r)
      setReqText('')
    } catch (err) {
      setReqError(err instanceof Error ? err.message : 'Could not send your request.')
    } finally {
      setSending(false)
    }
  }

  const chips: string[] = []
  if (result) {
    const u = result.understood
    chips.push(u.listing_type === 'rent' ? 'To rent' : 'To buy')
    if (u.location) chips.push(u.location)
    if (u.property_type) chips.push(u.property_type)
    if (u.bedrooms != null) chips.push(`${u.bedrooms} bed`)
    if (u.budget_max) chips.push(`Up to ${formatCurrency(u.budget_max, 'sale')}`)
  }

  return (
    <div>
      <section className="mk-hero">
        <h1>Find your next property.</h1>
        <p>Tell us what you are looking for. We send your request to agents with matching listings and show you what is already available.</p>
        <form className="mk-request" onSubmit={(e) => void onSend(e)}>
          <textarea
            className="textarea"
            placeholder="e.g. 3 bedroom house in Chitungwiza, budget US$40,000"
            value={reqText}
            maxLength={800}
            onChange={(e) => setReqText(e.target.value)}
            required
          />
          <div className="mk-row2">
            <input className="input" placeholder="Your name" value={reqName} maxLength={80} onChange={(e) => setReqName(e.target.value)} required />
            <input className="input" placeholder="Phone / WhatsApp number" inputMode="tel" value={reqPhone} maxLength={20} onChange={(e) => setReqPhone(e.target.value)} required />
          </div>
          <input className="mk-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={reqWebsite} onChange={(e) => setReqWebsite(e.target.value)} />
          {reqError && <div className="mk-err">{reqError}</div>}
          <button type="submit" className="btn btn-blue btn-lg" disabled={sending}>{sending ? 'Sending…' : 'Send my request'}</button>
          <p className="mk-note">Your name and number are shared only with the agents who receive your request.</p>
        </form>
      </section>

      {result && (
        <section className="mk-result">
          <strong style={{ color: 'var(--heading)' }}>
            {result.agents_notified > 0
              ? `Request sent to ${result.agents_notified} agent${result.agents_notified === 1 ? '' : 's'}.`
              : 'Request received.'}
          </strong>
          <div className="mk-chips">{chips.map((c) => <span key={c} className="mk-chip">{c}</span>)}</div>
          {result.matches.length > 0 ? (
            <>
              <p className="muted" style={{ margin: '0 0 12px' }}>Already available and matching what you described:</p>
              <div className="mk-grid">
                {result.matches.map((m) => (
                  <ListingCard
                    key={m.property_id}
                    id={m.property_id}
                    title={m.title}
                    price={m.price}
                    location={m.location}
                    listingType={m.listing_type}
                    bedrooms={m.bedrooms}
                    imagePath={m.image_path}
                    reasons={m.reasons}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Nothing live matches yet. Agents who see your request will contact you on the number you gave.
            </p>
          )}
        </section>
      )}

      <h2 className="page-title" style={{ margin: '0 0 12px' }}>Live properties</h2>
      <div className="mk-filters">
        <input className="input" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        <select className="select" value={listingType} onChange={(e) => setListingType(e.target.value)}>
          <option value="">Sale or rent</option>
          <option value="sale">For sale</option>
          <option value="rent">For rent</option>
        </select>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Any type</option>
          {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input className="input" type="number" min={0} inputMode="numeric" placeholder="Max price (US$)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <input className="input" type="number" min={0} inputMode="numeric" placeholder="Min bedrooms" value={beds} onChange={(e) => setBeds(e.target.value)} />
      </div>

      {loadError && <div className="mk-err" style={{ marginBottom: 12 }}>{loadError}</div>}
      {loading ? (
        <p className="muted">Loading properties…</p>
      ) : listings.length === 0 ? (
        <div className="mk-empty">
          <strong style={{ color: 'var(--heading)' }}>No properties found</strong>
          <p className="muted" style={{ margin: '6px 0 0' }}>Try different filters, or send a request above and agents will reach out.</p>
        </div>
      ) : (
        <div className="mk-grid">
          {listings.map((l) => (
            <ListingCard
              key={l.property_id}
              id={l.property_id}
              title={l.title}
              price={l.price}
              location={l.location}
              listingType={l.listing_type}
              bedrooms={l.bedrooms}
              imagePath={l.image_paths[0] ?? null}
              status={l.status}
            />
          ))}
        </div>
      )}
    </div>
  )
}
