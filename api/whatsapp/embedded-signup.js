import { adminSupabase, assertWhatsAppBusinessAccess, getPhoneNumber, graphBase, verifyUser } from '../../server/whatsapp.mjs'

async function exchangeCode(code) {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) throw new Error('Meta Embedded Signup is not configured on the server. Add META_APP_ID and META_APP_SECRET.')

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  })
  const response = await fetch(`${graphBase()}/oauth/access_token?${params.toString()}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.access_token) throw new Error(data?.error?.message || 'Meta authorization could not be completed.')
  return data.access_token
}

async function subscribeAppToWaba(wabaId, accessToken) {
  const response = await fetch(`${graphBase()}/${encodeURIComponent(wabaId)}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message || 'Meta did not enable webhook delivery for this business account.')
  return data
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await verifyUser(req.headers.authorization)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  try {
    await assertWhatsAppBusinessAccess(auth.user.id)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    const code = String(body.code || '').trim()
    const wabaId = String(body.waba_id || '').trim()
    const phoneNumberId = String(body.phone_number_id || '').trim()

    if (!code) return res.status(400).json({ error: 'Meta did not return an authorization code.' })
    if (!wabaId || !phoneNumberId) return res.status(400).json({ error: 'Meta did not return the WhatsApp Business account and phone number details. Please complete the Meta setup and try again.' })

    const accessToken = await exchangeCode(code)
    const phone = await getPhoneNumber({ phoneNumberId, accessToken })

    // Enable webhook delivery for the WABA. This is safe to repeat for an already subscribed app.
    await subscribeAppToWaba(wabaId, accessToken)

    const db = adminSupabase()
    const agentId = auth.user.id
    const { data: connection, error: connectionError } = await db.from('whatsapp_connections').upsert({
      agent_id: agentId,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone_number: phone.display_phone_number || null,
      business_name: phone.verified_name || null,
      status: 'connected',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_id,phone_number_id' }).select('id,waba_id,phone_number_id,display_phone_number,business_name,status').single()

    if (connectionError) throw connectionError

    const { error: secretError } = await db.from('whatsapp_connection_secrets').upsert({
      connection_id: connection.id,
      access_token: accessToken,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'connection_id' })
    if (secretError) throw secretError

    return res.status(200).json({ connection })
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'WhatsApp connection failed.' })
  }
}
