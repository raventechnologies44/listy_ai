import { adminSupabase, assertWhatsAppBusinessAccess, getConnectionSecret, getPhoneNumber, sendWhatsAppText, verifyUser } from '../../server/whatsapp.mjs'

export default async function handler(req, res) {
  const auth = await verifyUser(req.headers.authorization)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })
  const db = adminSupabase()
  const agentId = auth.user.id
  try {
    if (req.method === 'GET') {
      await assertWhatsAppBusinessAccess(agentId)
      const { data, error } = await db.from('whatsapp_connections').select('id,waba_id,phone_number_id,display_phone_number,business_name,status,created_at,updated_at').eq('agent_id', agentId).order('created_at', { ascending: false })
      if (error) throw error
      return res.status(200).json({ connections: data || [] })
    }
    if (req.method === 'POST') {
      await assertWhatsAppBusinessAccess(agentId)
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const { wabaId, phoneNumberId, accessToken, displayPhoneNumber, businessName } = body || {}
      if (!wabaId || !phoneNumberId || !accessToken) return res.status(400).json({ error: 'WABA ID, Phone Number ID and access token are required for the admin fallback connection flow.' })
      const phone = await getPhoneNumber({ phoneNumberId, accessToken })
      const { data: connection, error: connectionError } = await db.from('whatsapp_connections').upsert({
        agent_id: agentId, waba_id: String(wabaId), phone_number_id: String(phoneNumberId),
        display_phone_number: displayPhoneNumber || phone.display_phone_number || null,
        business_name: businessName || phone.verified_name || null, status: 'connected', updated_at: new Date().toISOString(),
      }, { onConflict: 'agent_id,phone_number_id' }).select('id,waba_id,phone_number_id,display_phone_number,business_name,status').single()
      if (connectionError) throw connectionError
      const { error: secretError } = await db.from('whatsapp_connection_secrets').upsert({ connection_id: connection.id, access_token: String(accessToken), updated_at: new Date().toISOString() }, { onConflict: 'connection_id' })
      if (secretError) throw secretError
      return res.status(200).json({ connection })
    }
    if (req.method === 'DELETE') {
      const id = String(req.query.id || '')
      if (!id) return res.status(400).json({ error: 'Connection id required' })
      const { error } = await db.from('whatsapp_connections').update({ status: 'disconnected', updated_at: new Date().toISOString() }).eq('id', id).eq('agent_id', agentId)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }
    if (req.method === 'PATCH') {
      await assertWhatsAppBusinessAccess(agentId)
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const id = String(body?.id || '')
      const text = String(body?.text || '').trim()
      const to = String(body?.to || '').replace(/\D/g, '')
      if (!id || !text || !to) return res.status(400).json({ error: 'Connection id, recipient and message text are required.' })
      const { data: connection, error } = await db.from('whatsapp_connections').select('id,agent_id,phone_number_id').eq('id', id).eq('agent_id', agentId).single()
      if (error) throw error
      const secret = await getConnectionSecret(connection.id)
      const result = await sendWhatsAppText({ phoneNumberId: connection.phone_number_id, accessToken: secret.access_token, to, body: text })
      await db.from('whatsapp_messages').insert({ connection_id: connection.id, agent_id: agentId, direction: 'outbound', whatsapp_message_id: result?.messages?.[0]?.id || null, phone_number: to, body: text, status: 'sent', raw_payload: result })
      return res.status(200).json({ result })
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'WhatsApp request failed' })
  }
}
