import {
  generateAiText,
  parseAiRequestBody,
  verifySupabaseUser,
  getUserPlan,
  assertAiTaskAccess,
} from '../../server/ai-generate.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const auth = await verifySupabaseUser({
    authHeader: req.headers.authorization,
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  })
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const parsed = parseAiRequestBody(body)
    const plan = await getUserPlan({
      supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
      accessToken: auth.token,
      userId: auth.user.id,
    })
    assertAiTaskAccess(plan, parsed.task)
    const text = await generateAiText({
      task: parsed.task,
      payload: parsed,
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL,
    })
    res.status(200).json({ text })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Generation failed' })
  }
}
