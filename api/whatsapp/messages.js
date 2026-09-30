import { adminSupabase, assertWhatsAppBusinessAccess, verifyUser } from '../../server/whatsapp.mjs'

export default async function handler(req, res) {
  const auth = await verifyUser(req.headers.authorization)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try { await assertWhatsAppBusinessAccess(auth.user.id) } catch (error) { return res.status(403).json({ error: error?.message || 'WhatsApp Business is not available on your plan.' }) }
  const db = adminSupabase()
  const { data, error } = await db.from('whatsapp_messages').select('id,connection_id,direction,whatsapp_message_id,phone_number,contact_name,body,status,extracted,lead_id,property_id,suggested_reply,error_message,created_at,processed_at').eq('agent_id', auth.user.id).order('created_at', { ascending: false }).limit(100)
  if (error) return res.status(400).json({ error: error.message })
  return res.status(200).json({ messages: data || [] })
}
