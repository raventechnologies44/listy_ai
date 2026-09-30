import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { canAccessFeature, getPlan } from '../lib/plans'
import { FeatureGate } from '../components/FeatureGate'

declare global {
  interface Window {
    FB?: {
      init: (options: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void
      login: (callback: (response: { authResponse?: { code?: string } }) => void, options: Record<string, unknown>) => void
    }
    fbAsyncInit?: () => void
  }
}

type Connection = {
  id: string
  waba_id: string
  phone_number_id: string
  display_phone_number: string | null
  business_name: string | null
  status: string
}

type Message = {
  id: string
  connection_id: string
  direction: 'inbound' | 'outbound'
  phone_number: string
  contact_name: string | null
  body: string | null
  status: string
  suggested_reply: string | null
  lead_id: string | null
  property_id: string | null
  created_at: string
}

type EmbeddedSignupData = {
  waba_id?: string
  phone_number_id?: string
  business_id?: string
}

const META_APP_ID = import.meta.env.VITE_META_APP_ID || ''
const META_CONFIG_ID = import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID || ''
const META_GRAPH_VERSION = import.meta.env.VITE_META_GRAPH_API_VERSION || 'v24.0'

let metaSdkPromise: Promise<void> | null = null

function loadMetaSdk() {
  if (window.FB) return Promise.resolve()
  if (metaSdkPromise) return metaSdkPromise

  metaSdkPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('facebook-jssdk')
    const finish = () => {
      if (window.FB) resolve()
      else reject(new Error('Meta could not load. Check your internet connection and Meta App configuration.'))
    }

    window.fbAsyncInit = () => {
      if (!window.FB) return reject(new Error('Meta SDK loaded without the Facebook SDK object.'))
      window.FB.init({ appId: META_APP_ID, cookie: true, xfbml: false, version: META_GRAPH_VERSION })
      resolve()
    }

    if (existing) {
      const timeout = window.setTimeout(finish, 2500)
      if (window.FB) {
        window.clearTimeout(timeout)
        finish()
      }
      return
    }

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.onerror = () => reject(new Error('Could not load Meta. Please check your internet connection.'))
    document.body.appendChild(script)

    window.setTimeout(finish, 8000)
  })

  return metaSdkPromise
}

export default function WhatsAppBusinessPage() {
  const { user, session, profile, loading: authLoading, profileLoading } = useAuth()
  const [connections, setConnections] = useState<Connection[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedConnection, setSelectedConnection] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const accessTokenRef = useRef(session?.access_token ?? '')
  useEffect(() => {
    accessTokenRef.current = session?.access_token ?? ''
  }, [session?.access_token])

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = accessTokenRef.current
    if (!token) throw new Error('You must be logged in.')
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('Content-Type', 'application/json')
    const response = await fetch(path, { ...init, headers })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`)
    return data
  }, [])

  const load = useCallback(async () => {
    if (!user?.id || !accessTokenRef.current || authLoading || profileLoading) return
    if (profile && !canAccessFeature(getPlan(profile), 'whatsapp_business')) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const connectionResponse = await api('/api/whatsapp/connection')
      const nextConnections = connectionResponse.connections || []
      setConnections(nextConnections)
      setSelectedConnection((current) => current || nextConnections[0]?.id || '')

      // Messages are independent of the connection request. Load them separately
      // so a connection/configuration error never causes the whole page to remount.
      try {
        const messageResponse = await api('/api/whatsapp/messages')
        setMessages(messageResponse.messages || [])
      } catch (messageError) {
        console.warn('ListyAI: WhatsApp messages could not be loaded:', messageError)
        setMessages([])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load WhatsApp Business data.'
      // Never sign the user out because a WhatsApp API request failed.
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [api, authLoading, profileLoading, profile, user?.id])

  useEffect(() => {
    if (authLoading || profileLoading || !user?.id || !accessTokenRef.current) return
    let cancelled = false
    const run = async () => {
      if (!cancelled) await load()
    }
    void run()
    return () => { cancelled = true }
  }, [authLoading, profileLoading, user?.id, load])

  const selected = useMemo(
    () => connections.find((item) => item.id === selectedConnection) || connections[0],
    [connections, selectedConnection],
  )
  const selectedMessages = useMemo(
    () => messages.filter((m) => !selected || m.connection_id === selected.id),
    [messages, selected],
  )

  async function connectWithMeta() {
    setConnecting(true)
    setError('')
    setNotice('')

    if (!META_APP_ID || !META_CONFIG_ID) {
      setConnecting(false)
      setError('WhatsApp connection is not configured yet. Your ListyAI administrator needs to add the Meta App ID and Embedded Signup Config ID.')
      return
    }

    let signupData: EmbeddedSignupData = {}
    let messageHandler: ((event: MessageEvent) => void) | null = null

    try {
      await loadMetaSdk()

      messageHandler = (event: MessageEvent) => {
        if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return
        if (typeof event.data !== 'object' || event.data === null) return
        if (event.data.type !== 'WA_EMBEDDED_SIGNUP') return
        signupData = { ...signupData, ...(event.data.data || {}) }
      }
      window.addEventListener('message', messageHandler)

      await new Promise<void>((resolve, reject) => {
        if (!window.FB) return reject(new Error('Meta login is unavailable.'))
        window.FB.login((response) => {
          const code = response.authResponse?.code
          if (!code) return reject(new Error('Meta connection was cancelled or did not return an authorization code.'))
          const finish = () => {
            void api('/api/whatsapp/embedded-signup', {
              method: 'POST',
              body: JSON.stringify({ code, ...signupData }),
            }).then(() => resolve()).catch(reject)
          }
          // Meta's embedded signup details arrive through postMessage. Give that
          // event a moment to arrive before the server exchanges the auth code.
          if (signupData.waba_id && signupData.phone_number_id) finish()
          else window.setTimeout(finish, 1200)
        }, {
          config_id: META_CONFIG_ID,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            feature: 'whatsapp_embedded_signup',
            version: 2,
          },
        })
      })

      setNotice('WhatsApp Business is connected. Your number is now ready to receive enquiries in ListyAI.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect WhatsApp Business.')
    } finally {
      if (messageHandler) window.removeEventListener('message', messageHandler)
      setConnecting(false)
    }
  }

  async function disconnect(id: string) {
    if (!window.confirm('Disconnect this WhatsApp Business number from ListyAI?')) return
    try {
      await api(`/api/whatsapp/connection?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      setNotice('WhatsApp Business number disconnected.')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not disconnect.') }
  }

  async function sendReply() {
    if (!selected || !replyTo || !replyText.trim()) return
    setSending(true); setError(''); setNotice('')
    try {
      await api('/api/whatsapp/connection', { method: 'PATCH', body: JSON.stringify({ id: selected.id, to: replyTo, text: replyText.trim() }) })
      setReplyText(''); setNotice('Message sent through WhatsApp Business.')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Message failed.') } finally { setSending(false) }
  }

  if (authLoading) return <div className="card pad">Loading your workspace…</div>
  if (!user) return null
  if (!canAccessFeature(getPlan(profile), 'whatsapp_business')) {
    return (
      <div>
        <div style={{ marginBottom: 18 }}>
          <span className="eyebrow">WHATSAPP BUSINESS</span>
          <h2 className="page-title" style={{ margin: '5px 0 3px' }}>Connect WhatsApp Business</h2>
          <p className="muted" style={{ margin: 0 }}>Bring your business conversations into the ListyAI workflow.</p>
        </div>
        <FeatureGate feature="whatsapp_business" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 className="page-title" style={{ marginBottom: 4 }}>WhatsApp Business</h2>
        <p className="muted" style={{ margin: 0 }}>Connect your business WhatsApp to bring customer enquiries directly into ListyAI.</p>
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}
      {notice && <div className="info-banner" style={{ marginBottom: 12 }}>{notice}</div>}

      {loading ? <div className="card pad">Loading WhatsApp Business…</div> : connections.length === 0 ? (
        <div className="wa-connect-wrap">
          <section className="card wa-connect-card">
            <div className="wa-logo" aria-hidden="true">◔</div>
            <span className="wa-eyebrow">WhatsApp Business</span>
            <h1>Connect your business WhatsApp</h1>
            <p className="wa-lead">Let ListyAI capture enquiries, organize leads, match buyers to properties, and keep your conversations connected to your sales workflow.</p>

            <div className="wa-benefits">
              <div><span>✓</span><div><strong>Bring enquiries into ListyAI</strong><small>Customer messages can become organized leads automatically.</small></div></div>
              <div><span>✓</span><div><strong>Match buyers to your listings</strong><small>ListyAI can use enquiry details to find relevant properties.</small></div></div>
              <div><span>✓</span><div><strong>Keep control of every reply</strong><small>AI can suggest responses, while you decide what gets sent.</small></div></div>
            </div>

            <button className="btn btn-blue wa-connect-btn" type="button" disabled={connecting} onClick={() => void connectWithMeta()}>
              <span className="wa-button-icon">◔</span>
              {connecting ? 'Connecting to Meta…' : 'Connect WhatsApp Business'}
            </button>
            <p className="wa-secure-note">You'll continue through Meta's secure setup. ListyAI does not ask you to enter your WhatsApp password or Meta access token.</p>
          </section>

          <section className="wa-steps">
            <div><span>1</span><div><strong>Connect</strong><p>Click the button and sign in with Meta.</p></div></div>
            <div><span>2</span><div><strong>Select your business number</strong><p>Choose or create the WhatsApp Business number you want to use.</p></div></div>
            <div><span>3</span><div><strong>You're ready</strong><p>ListyAI receives the connection and starts routing enquiries to your workspace.</p></div></div>
          </section>
        </div>
      ) : (
        <>
          <div className="card pad" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="wa-connected-icon">◔</div>
                <div>
                  <div className="wa-eyebrow" style={{ marginBottom: 2 }}>Connected</div>
                  <strong style={{ fontSize: 17 }}>{selected?.business_name || 'WhatsApp Business'}</strong>
                  <div className="muted">{selected?.display_phone_number || 'Business number connected'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" type="button" onClick={() => void load()}>Refresh</button>
                <button className="btn btn-danger" type="button" onClick={() => selected && void disconnect(selected.id)}>Disconnect</button>
              </div>
            </div>
          </div>

          {connections.length > 1 && <div className="card pad" style={{ marginBottom: 12 }}><strong>Connected numbers</strong>{connections.map((connection) => <button key={connection.id} type="button" className="btn btn-ghost" onClick={() => setSelectedConnection(connection.id)} style={{ display: 'block', textAlign: 'left', width: '100%', marginTop: 8 }}>{connection.business_name || 'WhatsApp Business'} — {connection.display_phone_number || connection.phone_number_id}</button>)}</div>}

          <div className="card pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div><h3 style={{ margin: 0 }}>WhatsApp inbox</h3><p className="muted" style={{ marginTop: 4 }}>Incoming messages are processed by Claude, matched to properties, and saved as leads.</p></div>
              <button className="btn" type="button" onClick={() => void load()}>Refresh</button>
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {selectedMessages.length === 0 ? <p className="muted">No messages yet. New enquiries will appear here once Meta webhook delivery is enabled for your connected business number.</p> : selectedMessages.map((message) => (
                <div key={message.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong>{message.contact_name || message.phone_number}</strong><span className="muted">{new Date(message.created_at).toLocaleString()}</span></div>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{message.body}</p>
                  <div className="muted" style={{ fontSize: 12 }}>Status: {message.status}{message.lead_id ? ' · Lead created/updated' : ''}{message.property_id ? ' · Property match found' : ''}</div>
                  {message.suggested_reply && <div style={{ marginTop: 10, padding: 10, background: 'var(--surface-2, #f6f7f9)', borderRadius: 8 }}><strong>Suggested reply</strong><p style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{message.suggested_reply}</p><button className="btn btn-blue" type="button" onClick={() => { setReplyTo(message.phone_number); setReplyText(message.suggested_reply || '') }}>Use reply</button></div>}
                </div>
              ))}
            </div>
          </div>

          {selected && <div className="card pad" style={{ marginTop: 12 }}><h3 style={{ marginTop: 0 }}>Send approved reply</h3><div className="filters"><div className="field"><label className="label">Recipient</label><input className="input" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="2637..." /></div><div className="field" style={{ gridColumn: '1 / -1' }}><label className="label">Message</label><textarea className="input" rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)} /></div></div><button className="btn btn-blue" type="button" disabled={sending || !replyTo || !replyText.trim()} onClick={() => void sendReply()}>{sending ? 'Sending…' : 'Send through WhatsApp'}</button></div>}
        </>
      )}
    </div>
  )
}
