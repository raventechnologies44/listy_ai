import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, getPublicImageUrl } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/format'
import type { Property } from '../types/database'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { SocialPublishPanel } from '../components/SocialPublishPanel'

interface PostRow {
  property_id: string
  channel: 'listymarket' | 'facebook' | 'instagram' | 'tiktok'
  created_at: string
}

interface ListingRow {
  property_id: string
  expires_at: string
  flagged: boolean
}

const SOCIALS: { id: PostRow['channel']; label: string }[] = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
]

export function PublishHubPage() {
  const { user } = useAuth()
  const [properties, setProperties] = useState<Property[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [listings, setListings] = useState<Record<string, ListingRow>>({})
  const [posts, setPosts] = useState<PostRow[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const [p, img, l, s] = await Promise.all([
      supabase.from('properties').select('*').eq('agent_id', user.id).order('created_at', { ascending: false }),
      supabase.from('property_images').select('property_id, storage_path').eq('agent_id', user.id).order('sort_order', { ascending: true }),
      supabase.from('published_listings').select('property_id, expires_at, flagged').eq('agent_id', user.id),
      supabase.from('social_posts').select('property_id, channel, created_at').eq('agent_id', user.id).order('created_at', { ascending: false }),
    ])
    const err = p.error ?? img.error ?? l.error ?? s.error
    if (err) setError(err.message)
    setProperties((p.data ?? []) as Property[])
    const t: Record<string, string> = {}
    for (const row of (img.data ?? []) as { property_id: string; storage_path: string }[]) {
      if (!t[row.property_id]) t[row.property_id] = getPublicImageUrl(row.storage_path)
    }
    setThumbs(t)
    setListings(Object.fromEntries(((l.data ?? []) as ListingRow[]).map((r) => [r.property_id, r])))
    setPosts((s.data ?? []) as PostRow[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingSpinner />

  function lastShared(propertyId: string, channel: PostRow['channel']): string | null {
    return posts.find((x) => x.property_id === propertyId && x.channel === channel)?.created_at ?? null
  }

  return (
    <div>
      <h2 className="page-title" style={{ margin: '0 0 6px' }}>Publish</h2>
      <p className="muted" style={{ margin: '0 0 16px' }}>
        Publish a property to ListyMarket and share it to Facebook, Instagram and TikTok with its photos. See where each property has gone.
      </p>
      {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}

      {properties.length === 0 ? (
        <div className="card pad empty-state">
          <h3>No properties yet</h3>
          <p className="muted">Add a property first, then publish it from here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {properties.map((prop) => {
            const listing = listings[prop.id]
            const live = Boolean(listing) && new Date(listing.expires_at) > new Date() && !listing.flagged
            const open = openId === prop.id
            return (
              <div className="card pad" key={prop.id}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      width: 72,
                      height: 56,
                      borderRadius: 10,
                      background: thumbs[prop.id] ? `center / cover no-repeat url(${thumbs[prop.id]})` : '#e8eef7',
                      flex: 'none',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <strong style={{ color: 'var(--heading)' }}>{prop.title}</strong>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {prop.location} · {formatCurrency(Number(prop.price), prop.listing_type)}
                    </div>
                  </div>
                  <button type="button" className="btn btn-blue btn-sm" onClick={() => setOpenId(open ? null : prop.id)}>
                    {open ? 'Close' : 'Publish'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  <span className={`badge ${live ? 'badge-available' : 'badge-sold'}`}>
                    ListyMarket: {live ? `Live until ${formatDate(listing.expires_at)}` : listing?.flagged ? 'Hidden' : 'Not live'}
                  </span>
                  {SOCIALS.map((c) => {
                    const when = lastShared(prop.id, c.id)
                    return (
                      <span key={c.id} className={`badge ${when ? 'badge-viewing' : 'badge-sold'}`}>
                        {c.label}: {when ? `Shared ${formatDate(when)}` : 'Not shared'}
                      </span>
                    )
                  })}
                </div>

                {open && (
                  <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <SocialPublishPanel property={prop} onPublished={() => void load()} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
