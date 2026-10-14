import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency, userInitials } from '../lib/format'
import { imageUrl, marketAction, statusNote, whatsappLink, type PublishedListing } from './marketApi'

export function AgentPostCard({ post }: { post: PublishedListing }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paths = post.post_image_paths.length > 0 ? post.post_image_paths : post.image_paths.slice(0, 4)
  const photos = paths.map((p) => imageUrl(p)).filter((u): u is string => Boolean(u))
  const caption = post.post_caption ?? ''
  const note = statusNote(post.status)
  const wa = whatsappLink(post.agent_phone, `Hi, I saw your post for "${post.title}" on ListyMarket.`)

  async function onSend(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      await marketAction('enquiry', { listing_id: post.property_id, name, phone, message, website })
      setSent(true)
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <article className="mk-post">
      <div className="mk-post-head">
        <div className="mk-avatar">{userInitials(post.agent_name)}</div>
        <div>
          <Link to={`/market/agent/${post.agent_id}`}>{post.agent_name || 'Agent'}</Link>
          <div className="mk-meta">
            {post.agent_brokerage || 'Real estate agent'} · {new Date(post.published_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {photos.length > 0 ? (
        <div className="mk-strip">
          {photos.map((u) => (
            <img key={u} src={u} alt={post.title} loading="lazy" />
          ))}
        </div>
      ) : (
        <div className="mk-strip"><div className="mk-strip-empty">No photos</div></div>
      )}

      <div className="mk-post-body">
        {caption && (
          <div>
            <p className={`mk-clamp${open ? ' open' : ''}`}>{caption}</p>
            {caption.length > 200 && (
              <button type="button" className="mk-link-btn" onClick={() => setOpen(!open)}>
                {open ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}
        <Link to={`/market/listing/${post.property_id}`} className="mk-post-listing">
          <strong style={{ color: 'var(--heading)' }}>{formatCurrency(Number(post.price), post.listing_type)}</strong>
          <span className="mk-meta"> · {post.title} · {post.location}{note ? ` · ${note}` : ''}</span>
        </Link>
      </div>

      <form className="mk-post-contact" onSubmit={(e) => void onSend(e)}>
        {sent ? (
          <div className="mk-ok">Message sent. The agent will contact you on the number you gave.</div>
        ) : (
          <>
            <textarea
              className="textarea"
              placeholder="Message the agent about this property…"
              value={message}
              maxLength={600}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
            {message.trim().length > 0 && (
              <>
                <div className="mk-row2">
                  <input className="input" placeholder="Your name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
                  <input className="input" placeholder="Phone / WhatsApp number" inputMode="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} required />
                </div>
                <input className="mk-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </>
            )}
            {error && <div className="mk-err">{error}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-blue" disabled={sending}>{sending ? 'Sending…' : 'Send message'}</button>
              {wa && <a className="btn mk-wa" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
            </div>
            <p className="mk-note">Your details go only to this agent.</p>
          </>
        )}
      </form>
    </article>
  )
}
