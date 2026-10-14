import type { Lead, Property } from '../types/database'

export interface PropertyMatch {
  property: Property
  score: number
  reasons: string[]
}

function parseBedroomHint(text: string): number | null {
  const m = text.match(/(\d+)\s*(-?\s*)?(bed|bedroom|br|bk)/i)
  if (m) return Number(m[1])
  return null
}

function locationMatch(leadReq: string, propertyLocation: string): { hit: boolean; reason?: string } {
  const req = leadReq.toLowerCase()
  const loc = propertyLocation.toLowerCase()
  const parts = loc.split(/[,/]/).map((p) => p.trim()).filter(Boolean)
  for (const part of parts) {
    if (part.length >= 3 && req.includes(part)) {
      return { hit: true, reason: `Location mention matches "${part}"` }
    }
  }
  if (req.length >= 3 && loc.includes(req.slice(0, 20))) {
    return { hit: true, reason: 'Requirements overlap with property location' }
  }
  return { hit: false }
}

function budgetScore(budget: number | null, price: number, listingType: Property['listing_type']): {
  points: number
  reason?: string
} {
  if (budget == null || budget <= 0) return { points: 0 }
  const p = Number(price)
  const ratio = p / budget
  if (listingType === 'rent') {
    if (ratio <= 1.05) return { points: 30, reason: 'Rent within lead budget' }
    if (ratio <= 1.15) return { points: 18, reason: 'Rent slightly above budget (within ~15%)' }
    if (ratio <= 1.25) return { points: 8, reason: 'Rent moderately above budget' }
    return { points: 0, reason: 'Rent likely above lead budget' }
  }
  if (ratio <= 1.05) return { points: 30, reason: 'Price within lead budget' }
  if (ratio <= 1.1) return { points: 22, reason: 'Price within ~10% of budget' }
  if (ratio <= 1.2) return { points: 12, reason: 'Price within ~20% of budget' }
  return { points: 0 }
}

export function matchLeadToProperties(lead: Lead, properties: Property[]): PropertyMatch[] {
  const req = (lead.requirements ?? '').trim()
  const bedHint = req ? parseBedroomHint(req) : null

  const scored = properties
    .filter((p) => p.status === 'available' || p.status === 'viewing' || p.status === 'negotiation')
    .map((property) => {
      const reasons: string[] = []
      let score = 0

      const b = budgetScore(lead.budget != null ? Number(lead.budget) : null, Number(property.price), property.listing_type)
      score += b.points
      if (b.reason && b.points > 0) reasons.push(b.reason)
      else if (b.reason && lead.budget) reasons.push(b.reason)

      if (req) {
        const loc = locationMatch(req, property.location)
        if (loc.hit) {
          score += 25
          if (loc.reason) reasons.push(loc.reason)
        }
        if (req.toLowerCase().includes(property.property_type)) {
          score += 15
          reasons.push(`Requirements mention property type (${property.property_type})`)
        }
      }

      if (bedHint != null && property.bedrooms != null) {
        if (property.bedrooms === bedHint) {
          score += 20
          reasons.push(`Bedrooms match (${bedHint})`)
        } else if (property.bedrooms >= bedHint) {
          score += 10
          reasons.push(`Bedrooms meet or exceed ${bedHint}`)
        }
      }

      if (lead.property_id && lead.property_id === property.id) {
        score += 15
        reasons.push('Linked to this lead')
      }

      if (reasons.length === 0) {
        reasons.push('Limited overlap with available lead criteria — review manually')
      }

      return { property, score, reasons }
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, 8)
}
