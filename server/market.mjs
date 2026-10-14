import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const ACTIVE = ['available', 'viewing', 'negotiation']
const DAY_MS = 24 * 60 * 60 * 1000
const MIN_MATCH_SCORE = 25
const PROPERTY_TYPES = ['house', 'apartment', 'condo', 'townhouse', 'land', 'commercial', 'other']

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function env(name) {
  return process.env[name] || ''
}

let testDb = null
export function __setTestDb(db) {
  testDb = db
}

export function getDb() {
  if (testDb) return testDb
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    const missing = [!url && 'SUPABASE_URL', !key && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean).join(' and ')
    throw new HttpError(500, `ListyMarket server storage is not configured. Missing: ${missing}. Check .env.local is saved next to package.json.`)
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function hashIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const ip = fwd || req.socket?.remoteAddress || 'unknown'
  const salt = env('MARKET_HASH_SALT') || env('SUPABASE_SERVICE_ROLE_KEY') || 'listymarket'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export function cleanText(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max)
}

export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null
  return { digits, key: digits.slice(-9) }
}

function since(ms) {
  return new Date(Date.now() - ms).toISOString()
}

/* ------------------------------------------------------------------ */
/* Request understanding                                              */
/* ------------------------------------------------------------------ */

function parseMoney(text) {
  const t = text.toLowerCase().replace(/,/g, '')
  const m = t.match(/(?:\$|usd\s*|us\$\s*)\s*(\d+(?:\.\d+)?)\s*(k|m)?|(\d+(?:\.\d+)?)\s*(k|m)\b|(\d{4,9})\b/)
  if (!m) return null
  let num
  let suffix
  if (m[1] != null) {
    num = Number(m[1])
    suffix = m[2]
  } else if (m[3] != null) {
    num = Number(m[3])
    suffix = m[4]
  } else {
    num = Number(m[5])
  }
  if (suffix === 'k') num *= 1000
  if (suffix === 'm') num *= 1000000
  return Number.isFinite(num) && num > 0 ? Math.round(num) : null
}

export function parseRequestRegex(text) {
  const t = text.toLowerCase()
  const bed = t.match(/(\d+)\s*[- ]?\s*(bed|bedroom|bedrooms|br|bdrm)/)
  const listing_type = /\b(rent|rental|to let|lease)\b/.test(t) ? 'rent' : 'sale'
  let property_type = null
  for (const type of PROPERTY_TYPES) {
    if (t.includes(type)) {
      property_type = type
      break
    }
  }
  if (!property_type && /\b(stand|plot|yard)\b/.test(t)) property_type = 'land'
  if (!property_type && /\bflat\b/.test(t)) property_type = 'apartment'
  const loc = text.match(/\b(?:in|at|around|near)\s+([A-Za-z][A-Za-z0-9 .'-]{2,40}?)(?=\s+(?:under|below|for|with|budget|at|around|max|up|that|which|,|\.|$)|[,.]|$)/i)
  return {
    location: loc ? loc[1].trim() : null,
    budget_max: parseMoney(text),
    property_type,
    listing_type,
    bedrooms: bed ? Number(bed[1]) : null,
    summary: text.slice(0, 140),
    source: 'rules',
  }
}

async function parseRequestAi(text) {
  const apiKey = env('ANTHROPIC_API_KEY')
  if (!apiKey) return null
  const prompt = `Extract property search criteria from this buyer message. The message may be in any language.
Respond with ONLY a JSON object, no markdown, with exactly these keys:
{"location": string|null, "budget_max": number|null (USD), "property_type": "house"|"apartment"|"condo"|"townhouse"|"land"|"commercial"|"other"|null, "listing_type": "sale"|"rent", "bedrooms": number|null, "summary": string (max 140 chars, English)}
Use null when the buyer did not say. Do not invent details.
If the buyer uses a nickname or abbreviation for a Zimbabwean place (e.g. "chitown" for Chitungwiza), write the full place name in location.

Buyer message:
"""${text}"""`
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env('ANTHROPIC_MODEL') || 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await response.json()
    if (!response.ok) return null
    const raw = data?.content?.find((c) => c.type === 'text')?.text ?? ''
    const obj = JSON.parse(raw.replace(/```json|```/g, '').trim())
    const budget = Number(obj.budget_max)
    const beds = Number(obj.bedrooms)
    return {
      location: typeof obj.location === 'string' && obj.location.trim() ? obj.location.trim().slice(0, 60) : null,
      budget_max: Number.isFinite(budget) && budget > 0 ? Math.round(budget) : null,
      property_type: PROPERTY_TYPES.includes(obj.property_type) ? obj.property_type : null,
      listing_type: obj.listing_type === 'rent' ? 'rent' : 'sale',
      bedrooms: Number.isFinite(beds) && beds >= 0 && beds < 30 ? Math.round(beds) : null,
      summary: cleanText(obj.summary || text, 140),
      source: 'ai',
    }
  } catch {
    return null
  }
}

export async function understandRequest(text) {
  const ai = await parseRequestAi(text)
  if (ai) {
    // The AI reads the text; plain rules fill any gap so a miss never drops a field we can see.
    const rules = parseRequestRegex(text)
    return {
      ...ai,
      budget_max: ai.budget_max ?? rules.budget_max,
      bedrooms: ai.bedrooms ?? rules.bedrooms,
      property_type: ai.property_type ?? rules.property_type,
      location: ai.location ?? rules.location,
    }
  }
  return parseRequestRegex(text)
}

/* ------------------------------------------------------------------ */
/* Matching: plain, deterministic scoring (no AI decides matches)      */
/* ------------------------------------------------------------------ */

// Common local nicknames people type instead of the full place name.
const PLACE_ALIASES = { chitown: 'chitungwiza', chitwon: 'chitungwiza', byo: 'bulawayo', hre: 'harare' }

function tokens(s) {
  return String(s ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((w) => PLACE_ALIASES[w] ?? w)
    .filter((w) => w.length >= 3 && !['the', 'and', 'road', 'street', 'avenue'].includes(w))
}

export function scoreListing(criteria, listing) {
  if (criteria.listing_type && listing.listing_type !== criteria.listing_type) return null
  const reasons = []
  let score = 0

  if (criteria.location) {
    const want = tokens(criteria.location)
    const have = new Set(tokens(listing.location))
    const hit = want.some((w) => have.has(w) || [...have].some((h) => h.startsWith(w) || w.startsWith(h)))
    if (!hit) return null
    score += 40
    reasons.push('Location matches')
  }

  if (criteria.budget_max) {
    const ratio = Number(listing.price) / criteria.budget_max
    if (ratio > 1.2) return null
    if (ratio <= 1) {
      score += 30
      reasons.push('Within budget')
    } else if (ratio <= 1.1) {
      score += 20
      reasons.push('Within ~10% of budget')
    } else {
      score += 10
      reasons.push('Within ~20% of budget')
    }
  }

  if (criteria.property_type) {
    if (listing.property_type === criteria.property_type) {
      score += 15
      reasons.push(`Type: ${listing.property_type}`)
    } else {
      return null
    }
  }

  if (criteria.bedrooms != null && listing.bedrooms != null) {
    if (listing.bedrooms === criteria.bedrooms) {
      score += 15
      reasons.push(`${listing.bedrooms} bedrooms`)
    } else if (listing.bedrooms > criteria.bedrooms) {
      score += 8
      reasons.push(`${listing.bedrooms} bedrooms (more than asked)`)
    } else {
      return null
    }
  }

  // Nothing specific was asked: nothing can be said to "match".
  if (score === 0) return null
  return { score, reasons }
}

async function loadLiveListings(db) {
  const { data, error } = await db
    .from('published_listings')
    .select('property_id, agent_id, title, price, location, listing_type, property_type, bedrooms, image_paths, status')
    .eq('flagged', false)
    .gt('expires_at', new Date().toISOString())
    .in('status', ACTIVE)
    .order('published_at', { ascending: false })
    .limit(1000)
  if (error) throw new HttpError(500, error.message)
  return data ?? []
}

/* ------------------------------------------------------------------ */
/* Actions                                                            */
/* ------------------------------------------------------------------ */

function guardBot(body) {
  // Honeypot: real people never fill the hidden "website" field.
  if (body.website) throw new HttpError(400, 'Request rejected')
}

export async function handleRequest(body, req) {
  guardBot(body)
  const name = cleanText(body.name, 80)
  const text = cleanText(body.text, 800)
  const phone = normalizePhone(body.phone)
  if (!name) throw new HttpError(400, 'Please enter your name.')
  if (!phone) throw new HttpError(400, 'Please enter a valid phone number.')
  if (text.length < 8) throw new HttpError(400, 'Please describe what you are looking for.')

  const db = getDb()
  const ipHash = hashIp(req)

  const [{ count: byPhone }, { count: byIp }] = await Promise.all([
    db.from('buyer_requests').select('id', { count: 'exact', head: true }).eq('phone_key', phone.key).gt('created_at', since(DAY_MS)),
    db.from('buyer_requests').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gt('created_at', since(DAY_MS)),
  ])
  if ((byPhone ?? 0) >= 3) throw new HttpError(429, 'You have sent several requests today. Please wait before sending another.')
  if ((byIp ?? 0) >= 10) throw new HttpError(429, 'Too many requests from this device today. Please try again tomorrow.')

  const criteria = await understandRequest(text)
  const listings = await loadLiveListings(db)

  const scored = []
  for (const l of listings) {
    const s = scoreListing(criteria, l)
    if (s && s.score >= MIN_MATCH_SCORE) scored.push({ listing: l, ...s })
  }
  scored.sort((a, b) => b.score - a.score)

  const { data: reqRow, error: reqErr } = await db
    .from('buyer_requests')
    .insert({ name, phone: phone.digits, phone_key: phone.key, raw_text: text, parsed: criteria, ip_hash: ipHash })
    .select('id')
    .single()
  if (reqErr) throw new HttpError(500, reqErr.message)

  // Route to the agents whose live listings fit best (max 5). If nothing fits,
  // still put the demand in front of up to 3 recently active agents.
  const byAgent = new Map()
  for (const m of scored) {
    const cur = byAgent.get(m.listing.agent_id) ?? { score: 0, ids: [] }
    cur.score = Math.max(cur.score, m.score)
    cur.ids.push(m.listing.property_id)
    byAgent.set(m.listing.agent_id, cur)
  }
  let recipients = [...byAgent.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
    .map(([agent_id, v]) => ({ agent_id, match_score: v.score, matched_property_ids: v.ids.slice(0, 10) }))

  if (recipients.length === 0) {
    const seen = new Set()
    for (const l of listings) {
      if (seen.size >= 3) break
      seen.add(l.agent_id)
    }
    recipients = [...seen].map((agent_id) => ({ agent_id, match_score: 0, matched_property_ids: [] }))
  }

  if (recipients.length > 0) {
    const { error: recErr } = await db
      .from('buyer_request_recipients')
      .insert(recipients.map((r) => ({ ...r, request_id: reqRow.id })))
    if (recErr) throw new HttpError(500, recErr.message)
  }

  return {
    ok: true,
    understood: {
      location: criteria.location,
      budget_max: criteria.budget_max,
      property_type: criteria.property_type,
      listing_type: criteria.listing_type,
      bedrooms: criteria.bedrooms,
    },
    agents_notified: recipients.length,
    matches: scored.slice(0, 6).map((m) => ({
      property_id: m.listing.property_id,
      title: m.listing.title,
      price: m.listing.price,
      location: m.listing.location,
      listing_type: m.listing.listing_type,
      bedrooms: m.listing.bedrooms,
      image_path: m.listing.image_paths?.[0] ?? null,
      score: m.score,
      reasons: m.reasons,
    })),
  }
}

export async function handleEnquiry(body, req) {
  guardBot(body)
  const name = cleanText(body.name, 80)
  const message = cleanText(body.message, 600)
  const phone = normalizePhone(body.phone)
  const propertyId = cleanText(body.listing_id, 60)
  if (!name) throw new HttpError(400, 'Please enter your name.')
  if (!phone) throw new HttpError(400, 'Please enter a valid phone number.')
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) throw new HttpError(400, 'Invalid listing.')

  const db = getDb()
  const ipHash = hashIp(req)

  const { data: listing, error: lErr } = await db
    .from('published_listings')
    .select('property_id, agent_id, title, price, status, expires_at, flagged')
    .eq('property_id', propertyId)
    .maybeSingle()
  if (lErr) throw new HttpError(500, lErr.message)
  if (!listing || listing.flagged || new Date(listing.expires_at) <= new Date() || !ACTIVE.includes(listing.status)) {
    throw new HttpError(404, 'This listing is no longer available.')
  }

  const [{ count: sameListing }, { count: byIp }] = await Promise.all([
    db.from('market_enquiries').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('phone_key', phone.key).gt('created_at', since(DAY_MS)),
    db.from('market_enquiries').select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash).gt('created_at', since(DAY_MS)),
  ])
  if ((sameListing ?? 0) >= 1) throw new HttpError(429, 'You already sent an enquiry for this property today.')
  if ((byIp ?? 0) >= 10) throw new HttpError(429, 'Too many enquiries from this device today.')

  const { data: lead, error: leadErr } = await db
    .from('leads')
    .insert({
      agent_id: listing.agent_id,
      property_id: listing.property_id,
      name,
      phone: phone.digits,
      requirements: message || `Enquiry about: ${listing.title}`,
      notes: 'Source: ListyMarket enquiry',
      stage: 'new',
    })
    .select('id')
    .single()
  if (leadErr) throw new HttpError(500, leadErr.message)

  const { error: enqErr } = await db.from('market_enquiries').insert({
    agent_id: listing.agent_id,
    property_id: listing.property_id,
    lead_id: lead.id,
    name,
    phone: phone.digits,
    phone_key: phone.key,
    message: message || null,
    ip_hash: ipHash,
  })
  if (enqErr) throw new HttpError(500, enqErr.message)

  return { ok: true }
}

export async function handleReview(body, req) {
  guardBot(body)
  const name = cleanText(body.name, 60)
  const comment = cleanText(body.comment, 600)
  const rating = Math.round(Number(body.rating))
  const phone = normalizePhone(body.phone)
  const agentId = cleanText(body.agent_id, 60)
  if (!name) throw new HttpError(400, 'Please enter your name.')
  if (!phone) throw new HttpError(400, 'Please enter the phone number you used when you contacted the agent.')
  if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, 'Choose a rating from 1 to 5.')
  if (!/^[0-9a-f-]{36}$/i.test(agentId)) throw new HttpError(400, 'Invalid agent.')

  const db = getDb()
  const ipHash = hashIp(req)

  const { count: verified } = await db
    .from('market_enquiries')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('phone_key', phone.key)
  if (!verified) {
    throw new HttpError(403, 'Only people who sent this agent an enquiry through ListyMarket can leave a review. Use the phone number from your enquiry.')
  }

  const { count: byIp } = await db
    .from('agent_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gt('created_at', since(DAY_MS))
  if ((byIp ?? 0) >= 5) throw new HttpError(429, 'Too many reviews from this device today.')

  const { error } = await db.from('agent_reviews').insert({
    agent_id: agentId,
    reviewer_name: name,
    phone_key: phone.key,
    rating,
    comment: comment || null,
    ip_hash: ipHash,
  })
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'You have already reviewed this agent.')
    throw new HttpError(500, error.message)
  }
  return { ok: true }
}

const REPORT_REASONS = ['sold_or_unavailable', 'wrong_price', 'fake_or_scam', 'wrong_photos', 'other']

export async function handleReport(body, req) {
  guardBot(body)
  const propertyId = cleanText(body.listing_id, 60)
  const reason = cleanText(body.reason, 40)
  const details = cleanText(body.details, 400)
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) throw new HttpError(400, 'Invalid listing.')
  if (!REPORT_REASONS.includes(reason)) throw new HttpError(400, 'Choose a reason.')

  const db = getDb()
  const ipHash = hashIp(req)

  const { count: byIp } = await db
    .from('listing_reports')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gt('created_at', since(DAY_MS))
  if ((byIp ?? 0) >= 10) throw new HttpError(429, 'Too many reports from this device today.')

  const { error } = await db.from('listing_reports').insert({
    property_id: propertyId,
    reason,
    details: details || null,
    ip_hash: ipHash,
  })
  if (error && error.code !== '23505') throw new HttpError(error.code === '23503' ? 404 : 500, error.message)

  const { count } = await db
    .from('listing_reports')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)
  if ((count ?? 0) >= 3) {
    await db.from('published_listings').update({ flagged: true }).eq('property_id', propertyId)
  }
  return { ok: true }
}
