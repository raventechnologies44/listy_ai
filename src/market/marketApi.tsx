import { getPublicImageUrl } from '../lib/supabase'
import type { ListingType, PropertyStatus, PropertyType } from '../types/database'

export interface PublishedListing {
  property_id: string
  agent_id: string
  title: string
  description: string | null
  property_type: PropertyType
  listing_type: ListingType
  price: number
  location: string
  bedrooms: number | null
  bathrooms: number | null
  size: number | null
  features: string[]
  status: PropertyStatus
  image_paths: string[]
  agent_name: string | null
  agent_phone: string | null
  agent_brokerage: string | null
  flagged: boolean
  post_caption: string | null
  post_image_paths: string[]
  published_at: string
  expires_at: string
}

export interface AgentReview {
  id: string
  agent_id: string
  reviewer_name: string
  rating: number
  comment: string | null
  created_at: string
}

export interface RequestMatch {
  property_id: string
  title: string
  price: number
  location: string
  listing_type: ListingType
  bedrooms: number | null
  image_path: string | null
  score: number
  reasons: string[]
}

export interface RequestResult {
  ok: true
  understood: {
    location: string | null
    budget_max: number | null
    property_type: string | null
    listing_type: ListingType
    bedrooms: number | null
  }
  agents_notified: number
  matches: RequestMatch[]
}

export function imageUrl(path: string | null | undefined): string | null {
  return path ? getPublicImageUrl(path) : null
}

export async function marketAction<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  let res: Response
  try {
    res = await fetch('/api/market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Something went wrong.')
  return data as T
}

/** wa.me link. Local Zimbabwean numbers (07…) become 263…. */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 7) return null
  const intl = digits.startsWith('0') ? `263${digits.slice(1)}` : digits
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function statusNote(status: PropertyStatus): string | null {
  if (status === 'viewing') return 'Viewings underway'
  if (status === 'negotiation') return 'Under offer'
  return null
}

export function averageRating(reviews: AgentReview[]): number {
  if (reviews.length === 0) return 0
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="mk-stars" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(value) ? 'on' : ''}>★</span>
      ))}
    </span>
  )
}
