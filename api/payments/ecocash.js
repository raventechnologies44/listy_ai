import { adminSupabase, verifyUser } from '../../server/whatsapp.mjs'

const PLANS = {
  starter: { name: 'Starter', amount: 15 },
  professional: { name: 'Professional', amount: 25 },
  agency: { name: 'Agency', amount: 50 },
}

function jsonBody(req) {
  if (!req.body) return {}
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await verifyUser(req.headers.authorization)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  let body
  try {
    body = jsonBody(req)
  } catch {
    return res.status(400).json({ error: 'Invalid request body.' })
  }

  const plan = String(body?.plan || '')
  const transactionReference = String(body?.transactionReference || '').trim()
  const selected = PLANS[plan]

  if (!selected) return res.status(400).json({ error: 'Invalid ListyAI plan.' })
  if (!transactionReference || transactionReference.length > 100) {
    return res.status(400).json({ error: 'Enter a valid EcoCash transaction reference.' })
  }

  const db = adminSupabase()
  const reference = `LISTY-${auth.user.id.slice(0, 8)}-${Date.now()}`

  const { data: payment, error: insertError } = await db.from('subscription_payments').insert({
    user_id: auth.user.id,
    plan,
    amount: selected.amount,
    currency: 'USD',
    provider: 'ecocash_manual',
    customer_phone: '0787422528',
    reference,
    provider_transaction_id: transactionReference,
    status: 'pending',
  }).select('id,reference,status,amount,currency,plan').single()

  if (insertError) return res.status(500).json({ error: insertError.message })

  return res.status(200).json({
    ok: true,
    paymentId: payment.id,
    reference,
    status: 'pending',
    message: `Payment submitted. We will verify EcoCash transaction ${transactionReference} and activate your ${selected.name} plan after confirmation.`,
  })
}
