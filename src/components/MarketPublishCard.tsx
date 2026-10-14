import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import type { Property } from '../types/database'

interface Props {
  property: Property
  photoCount: number
}

interface ListingState {
  expires_at: string
  flagged: boolean
}

export function MarketPublishCard({ property, photoCount }: Props) {
  const [listing, setListing] = useState<ListingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('published_listings')
      .select('expires_at, flagged')
      .eq('property_id', property.id)
      .maybeSingle()
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setListing((data ?? null) as ListingState | null)
  }, [property.id])

  useEffect(() => {
    void load()
  }, [load, property.status, property.updated_at, photoCount])

  async function publish() {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('publish_listing', { p_property_id: property.id })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await load()
  }

  async function unpublish() {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('unpublish_listing', { p_property_id: property.id })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await load()
  }

  const url = `${window.location.origin}/market/listing/${property.id}`
  const expired = listing ? new Date(listing.expires_at) <= new Date() : false
  const inactive = property.status === 'sold' || property.status === 'rented'
  const live = Boolean(listing) && !expired && !listing?.flagged && !inactive

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy the link.')
    }
  }

  return (
    <div className="card pad" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--heading)' }}>ListyMarket</h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            {loading
              ? 'Checking…'
              : live
                ? `Live to customers until ${formatDate(listing!.expires_at)}.`
                : listing?.flagged
                  ? 'Hidden: customers reported this listing. Contact VELORA to have it reviewed.'
                  : expired
                    ? 'Expired. Renew to show it to customers again.'
                    : listing && inactive
                      ? `Not shown while the property is ${property.status}.`
                      : 'Not published. Publish it so customers can find it and enquire directly.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {listing ? (
            <>
              <button type="button" className="btn" onClick={() => void publish()} disabled={busy}>Renew 30 days</button>
              <button type="button" className="btn btn-danger" onClick={() => void unpublish()} disabled={busy}>Unpublish</button>
            </>
          ) : (
            <button type="button" className="btn btn-blue" onClick={() => void publish()} disabled={busy || loading}>
              {busy ? 'Publishing…' : 'Publish to ListyMarket'}
            </button>
          )}
        </div>
      </div>

      {!listing && photoCount === 0 && (
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>
          Tip: add at least one photo first. Listings with photos get far more enquiries.
        </p>
      )}
      {!listing && (
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 12 }}>
          Publishing shows the title, description, price, location, photos and your name, brokerage and phone number publicly. Internal notes stay private.
        </p>
      )}
      {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}

      {live && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Link to={`/market/listing/${property.id}`} className="btn btn-sm" target="_blank">View on ListyMarket</Link>
          <button type="button" className="btn btn-sm" onClick={() => void copy()}>{copied ? 'Link copied' : 'Copy link'}</button>
        </div>
      )}
    </div>
  )
}
