import { createClient } from '@supabase/supabase-js'
import { canAccessFeature, featureForAiTask, normalizePlan } from './plans.mjs'

const TASK_PROMPTS = {
  property_description:
    'Write a professional property listing description (2–4 paragraphs) for marketing. Do not invent facts not in the data.',
  whatsapp_ad:
    'Write a concise WhatsApp advert message (under 400 words) with emojis used sparingly. Include a clear call to action.',
  social_caption:
    'Write an engaging social media caption for Instagram/Facebook (under 2200 characters).',
  hashtags:
    'Suggest 15–25 relevant real estate hashtags, one per line, without numbering.',
  video_script:
    'Write a 30–45 second short-form video script for a property tour. Include scene directions in [brackets].',
  follow_up:
    'Write a friendly follow-up message suitable for WhatsApp or email. Reference the lead context; do not claim you already sent anything.',
  whatsapp_reply:
    'Write a helpful WhatsApp reply to a buyer enquiry. Be professional and concise. Do not invent property facts not in the data.',
}

function buildUserPrompt(task, payload) {
  const { property, lead, agentName, enquiryMessage } = payload
  let context = `Agent: ${agentName || 'Real estate agent'}\n`
  if (enquiryMessage) {
    context += `\nIncoming WhatsApp enquiry:\n${enquiryMessage}\n`
  }
  if (property) {
    context += `\nProperty data (use only these facts):\n${JSON.stringify(property, null, 2)}\n`
  }
  if (lead) {
    context += `\nLead data:\n${JSON.stringify(lead, null, 2)}\n`
  }
  const instruction = TASK_PROMPTS[task]
  if (!instruction) throw new Error('Invalid task')
  return `${instruction}\n\n${context}\nRespond with the content only, no preamble.`
}

export async function generateAiText({ task, payload, apiKey, model }) {
  if (!apiKey) {
    throw new Error('AI is not configured on the server (missing ANTHROPIC_API_KEY).')
  }
  const prompt = buildUserPrompt(task, payload)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    const msg = data?.error?.message || data?.message || `AI request failed (${response.status})`
    throw new Error(msg)
  }
  const text = data?.content?.find((c) => c.type === 'text')?.text
  if (!text) throw new Error('Empty AI response')
  return text.trim()
}

export async function verifySupabaseUser({ authHeader, supabaseUrl, supabaseAnonKey }) {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing authorization' }
  }
  const token = authHeader.slice(7)
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, status: 500, error: 'Server auth not configured' }
  }
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
  })
  if (!res.ok) {
    return { ok: false, status: 401, error: 'Invalid session' }
  }
  const user = await res.json()
  return { ok: true, user, token }
}

export async function getUserPlan({ supabaseUrl, supabaseAnonKey, accessToken, userId }) {
  if (!supabaseUrl || !supabaseAnonKey || !accessToken || !userId) return 'professional'
  try {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.from('profiles').select('subscription_plan').eq('id', userId).maybeSingle()
    if (error) return 'professional'
    return normalizePlan(data?.subscription_plan)
  } catch {
    return 'professional'
  }
}

export function assertAiTaskAccess(plan, task) {
  const feature = featureForAiTask(task)
  if (!feature || !canAccessFeature(plan, feature)) {
    throw new Error('This AI feature is not included in your current plan. Upgrade your ListyAI plan to continue.')
  }
}

export function parseAiRequestBody(body) {
  const { task, property, lead, agentName } = body || {}
  const allowed = Object.keys(TASK_PROMPTS)
  if (!task || !allowed.includes(task)) {
    throw new Error(`Invalid task. Allowed: ${allowed.join(', ')}`)
  }
  if ((task === 'follow_up' || task === 'whatsapp_reply') && !lead && !property) {
    throw new Error('Lead or property context required')
  }
  if (task !== 'follow_up' && task !== 'whatsapp_reply' && !property) {
    throw new Error('Property data required')
  }
  return { task, property, lead, agentName }
}
