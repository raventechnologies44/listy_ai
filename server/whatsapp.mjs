import { createClient } from '@supabase/supabase-js'
import { canAccessFeature, normalizePlan, hasActiveSubscription } from './plans.mjs'

function env(name) {
  return process.env[name] || ''
}

export function adminSupabase() {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('WhatsApp server storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function verifyUser(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return { ok: false, status: 401, error: 'Missing authorization' }
  const token = authHeader.slice(7)
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const anon = env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY')
  if (!url || !anon) return { ok: false, status: 500, error: 'Supabase server auth is not configured' }
  const res = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon } })
  if (!res.ok) return { ok: false, status: 401, error: 'Invalid session' }
  return { ok: true, user: await res.json() }
}

export async function getAgentPlan(agentId) {
  const db = adminSupabase()
  const { data, error } = await db.from('profiles').select('subscription_plan,subscription_status,trial_ends_at').eq('id', agentId).maybeSingle()
  if (error || !hasActiveSubscription(data)) return null
  return normalizePlan(data?.subscription_plan)
}

export async function assertWhatsAppBusinessAccess(agentId) {
  const plan = await getAgentPlan(agentId)
  if (!plan || !canAccessFeature(plan, 'whatsapp_business')) {
    throw new Error('WhatsApp Business is available on Professional and Agency plans.')
  }
  return plan
}

export function graphBase() {
  const version = env('META_GRAPH_API_VERSION') || 'v24.0'
  return `https://graph.facebook.com/${version}`
}

export async function graphRequest(path, options = {}) {
  const url = `${graphBase()}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.error?.message || data?.message || `WhatsApp API request failed (${res.status})`
    throw new Error(message)
  }
  return data
}

export async function sendWhatsAppText({ phoneNumberId, accessToken, to, body }) {
  return graphRequest(`/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body } }),
  })
}

export async function getPhoneNumber({ phoneNumberId, accessToken }) {
  return graphRequest(`/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function processIncomingWithClaude({ apiKey, model, message }) {
  if (!apiKey) return null
  const prompt = `You are ListyAI, a real-estate CRM assistant. Extract structured information from this incoming WhatsApp enquiry. Return ONLY valid JSON with keys: name, phone, email, budget, location, bedrooms, bathrooms, property_type, listing_intent, requirements, enquiry_summary, viewing_requested, availability_question, suggested_reply. Use null for missing scalar values and false for missing booleans. Never invent facts. Suggested reply must be short, professional, and must not claim a viewing is booked.\n\nIncoming message:\n${message}`
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model || 'claude-sonnet-4-6', max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message || `Claude request failed (${response.status})`)
  const text = data?.content?.find((part) => part.type === 'text')?.text?.trim()
  if (!text) return null
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (match?.[1] || text).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(candidate.slice(start, end + 1)) } catch { return null }
}

export async function findConnectionByPhoneNumberId(phoneNumberId) {
  const db = adminSupabase()
  const { data, error } = await db.from('whatsapp_connections').select('id,agent_id,waba_id,phone_number_id,display_phone_number,business_name,status').eq('phone_number_id', phoneNumberId).eq('status', 'connected').maybeSingle()
  if (error) throw error
  return data
}

export async function getConnectionSecret(connectionId) {
  const db = adminSupabase()
  const { data, error } = await db.from('whatsapp_connection_secrets').select('connection_id,access_token').eq('connection_id', connectionId).single()
  if (error) throw error
  return data
}

export async function matchAndSaveLead({ agentId, parsed, rawMessage, suggestedReply }) {
  const db = adminSupabase()
  const phone = parsed?.phone ? String(parsed.phone) : null
  const email = parsed?.email ? String(parsed.email).toLowerCase() : null
  let query = db.from('leads').select('id,name,phone,email,budget,requirements,notes,stage,property_id').eq('agent_id', agentId).limit(200)
  const { data: leads, error } = await query
  if (error) throw error
  const normalize = (v) => String(v || '').replace(/\D/g, '')
  const samePhone = phone ? normalize(phone).slice(-9) : ''
  const lead = (leads || []).find((row) => (samePhone && normalize(row.phone).slice(-9) === samePhone) || (email && String(row.email || '').toLowerCase() === email))
  const budget = Number.isFinite(Number(parsed?.budget)) ? Number(parsed.budget) : null
  const requirements = String(parsed?.requirements || parsed?.enquiry_summary || rawMessage).slice(0, 2000)
  const notes = `WhatsApp enquiry: ${String(rawMessage).slice(0, 1800)}`
  const leadPayload = {
    agent_id: agentId,
    name: String(parsed?.name || 'WhatsApp lead').slice(0, 120),
    phone,
    email,
    budget,
    requirements,
    notes,
    stage: lead?.stage || 'new',
    property_id: lead?.property_id || null,
    last_contact_at: new Date().toISOString(),
    next_follow_up_at: new Date(Date.now() + 2 * 86400000).toISOString(),
  }
  let saved
  if (lead?.id) {
    const { data, error: updateError } = await db.from('leads').update(leadPayload).eq('id', lead.id).select('id').single()
    if (updateError) throw updateError
    saved = data
  } else {
    const { data, error: insertError } = await db.from('leads').insert(leadPayload).select('id').single()
    if (insertError) throw insertError
    saved = data
  }

  const { data: properties, error: propertyError } = await db.from('properties').select('id,title,description,property_type,listing_type,price,location,bedrooms,bathrooms,status').eq('agent_id', agentId).limit(200)
  if (propertyError) throw propertyError
  const location = String(parsed?.location || '').toLowerCase()
  const type = String(parsed?.property_type || '').toLowerCase()
  const bedrooms = parsed?.bedrooms == null ? null : Number(parsed.bedrooms)
  const maxBudget = budget
  const ranked = (properties || []).map((p) => {
    let score = 0
    if (location && String(p.location || '').toLowerCase().includes(location)) score += 40
    if (bedrooms != null && Number(p.bedrooms) === bedrooms) score += 25
    if (maxBudget != null && Number(p.price) <= maxBudget * 1.08) score += 20
    if (type && String(p.property_type || '').toLowerCase().includes(type)) score += 15
    if (/available/i.test(String(p.status))) score += 10
    if (/sold|rented/i.test(String(p.status))) score -= 30
    return { ...p, score }
  }).filter((p) => p.score >= 10).sort((a, b) => b.score - a.score).slice(0, 3)
  const best = ranked[0] || null

  await db.from('whatsapp_enquiries').insert({
    agent_id: agentId,
    raw_message: rawMessage,
    extracted_name: parsed?.name ? String(parsed.name) : null,
    extracted_phone: phone,
    extracted_email: email,
    extracted_budget: budget,
    extracted_requirements: requirements,
    lead_id: saved.id,
    property_id: best?.id || null,
    suggested_reply: suggestedReply || parsed?.suggested_reply || null,
  })

  return { leadId: saved.id, match: best, suggestedReply: suggestedReply || parsed?.suggested_reply || null }
}
