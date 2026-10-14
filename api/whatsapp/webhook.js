import { createClient } from '@supabase/supabase-js'
import { findConnectionByPhoneNumberId, getConnectionSecret, getAgentPlan, matchAndSaveLead, processIncomingWithClaude } from '../../server/whatsapp.mjs'
import { canAccessFeature } from '../../server/plans.mjs'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(challenge)
    return res.status(403).send('Verification failed')
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const db = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    for (const entry of body?.entry || []) {
      for (const change of entry?.changes || []) {
        if (change?.field !== 'messages') continue
        const value = change.value || {}
        const phoneNumberId = value?.metadata?.phone_number_id
        if (!phoneNumberId) continue
        const connection = await findConnectionByPhoneNumberId(phoneNumberId)
        if (!connection) continue
        const plan = await getAgentPlan(connection.agent_id)
        if (!canAccessFeature(plan, 'whatsapp_business')) continue
        await getConnectionSecret(connection.id)
        for (const message of value?.messages || []) {
          if (message.type !== 'text' || !message.text?.body) continue
          const from = message.from
          const raw = message.text.body
          const messageId = message.id
          const contactName = value?.contacts?.find((c) => c.wa_id === from)?.profile?.name || null
          await db.from('whatsapp_messages').upsert({
            connection_id: connection.id, agent_id: connection.agent_id, direction: 'inbound',
            whatsapp_message_id: messageId, phone_number: from, contact_name: contactName,
            body: raw, status: 'received', raw_payload: message,
          }, { onConflict: 'whatsapp_message_id' })
          try {
            const parsed = await processIncomingWithClaude({ apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL, message: raw })
            const result = await matchAndSaveLead({
              agentId: connection.agent_id,
              parsed: { ...(parsed || {}), phone: parsed?.phone || from, name: parsed?.name || contactName || '' },
              rawMessage: raw,
              suggestedReply: parsed?.suggested_reply,
            })
            await db.from('whatsapp_messages').update({
              extracted: parsed, lead_id: result.leadId, property_id: result.match?.id || null,
              suggested_reply: result.suggestedReply, status: 'processed', processed_at: new Date().toISOString(),
            }).eq('whatsapp_message_id', messageId)
          } catch (processingError) {
            await db.from('whatsapp_messages').update({ status: 'processing_error', error_message: processingError?.message || 'Processing failed' }).eq('whatsapp_message_id', messageId)
          }
        }
      }
    }
    return res.status(200).json({ received: true })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Webhook failed' })
  }
}
