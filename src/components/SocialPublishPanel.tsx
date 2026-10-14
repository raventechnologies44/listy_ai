import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePropertyImages } from '../hooks/usePropertyImages'
import { requestAiGeneration } from '../lib/ai'
import { canAccessFeature, getPlan, hasActivePlanAccess } from '../lib/plans'
import { supabase } from '../lib/supabase'
import type { Property } from '../types/database'

type ChannelId = 'listymarket' | 'facebook' | 'instagram' | 'tiktok'

const CHANNELS: { id: ChannelId; label: string; hint: string; url?: string }[] = [
  { id: 'listymarket', label: 'ListyMarket', hint: 'Goes live immediately and shows in Agent posts' },
  { id: 'facebook', label: 'Facebook', hint: 'Opens Facebook with your photos and caption ready', url: 'https://www.facebook.com/' },
  { id: 'instagram', label: 'Instagram', hint: 'Opens Instagram with your photos and caption ready', url: 'https://www.instagram.com/' },
  { id: 'tiktok', label: 'TikTok', hint: 'Opens TikTok upload with your photos and caption ready', url: 'https://www.tiktok.com/upload' },
]

const MAX_PHOTOS = 10

interface Props {
  property: Property
  suggestedCaption?: string
  onPublished?: () => void
}

function isMobileDevice(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function SocialPublishPanel({ property, suggestedCaption, onPublished }: Props) {
  const { profile } = useAuth()
  const plan = getPlan(profile)
  const canGenerate = hasActivePlanAccess(profile) && canAccessFeature(plan, 'ai_social_marketing')
  const { images, loading: imagesLoading } = usePropertyImages(property.id, property.agent_id)

  const [caption, setCaption] = useState(suggestedCaption ?? '')
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [channels, setChannels] = useState<Set<ChannelId>>(new Set(['listymarket']))
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (suggestedCaption) setCaption(suggestedCaption)
  }, [suggestedCaption])

  const selectedIds = useMemo(() => {
    if (picked) return picked
    return new Set(images.slice(0, MAX_PHOTOS).map((i) => i.id))
  }, [picked, images])

  const chosen = images.filter((i) => selectedIds.has(i.id))

  function toggleImage(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else if (next.size < MAX_PHOTOS) next.add(id)
    setPicked(next)
  }

  function toggleChannel(id: ChannelId) {
    setChannels((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function generateCaption() {
    setGenerating(true)
    setError(null)
    const [cap, tags] = await Promise.all([
      requestAiGeneration({ task: 'social_caption', property, agentName: profile?.full_name }),
      requestAiGeneration({ task: 'hashtags', property, agentName: profile?.full_name }),
    ])
    setGenerating(false)
    if (cap.error) {
      setError(cap.error)
      return
    }
    setCaption([cap.text, tags.text].filter(Boolean).join('\n\n'))
  }

  async function publish() {
    setError(null)
    setMessage(null)
    const selected = CHANNELS.filter((c) => channels.has(c.id))
    if (selected.length === 0) {
      setError('Choose at least one place to publish.')
      return
    }
    const socials = selected.filter((c) => c.id !== 'listymarket')
    if (socials.length > 0 && chosen.length === 0) {
      setError('Add at least one photo to the listing before sharing to social media.')
      return
    }
    setBusy(true)

    // Browsers only allow new tabs straight after a click, so open them before any waiting.
    const mobile = isMobileDevice()
    let blockedTabs = false
    if (!mobile) {
      for (const c of socials) {
        const w = c.url ? window.open(c.url, '_blank') : null
        if (!w) blockedTabs = true
      }
    }

    const notes: string[] = []
    const logged: { channel: ChannelId; status: 'published' | 'shared' }[] = []

    try {
      if (channels.has('listymarket')) {
        const { error: rpcErr } = await supabase.rpc('publish_listing_post', {
          p_property_id: property.id,
          p_caption: caption,
          p_image_paths: chosen.map((img) => img.storage_path),
        })
        if (rpcErr) throw new Error(`ListyMarket: ${rpcErr.message}`)
        logged.push({ channel: 'listymarket', status: 'published' })
        notes.push(
          caption.trim()
            ? 'Live on ListyMarket for 30 days, and your post appears in Agent posts.'
            : 'Live on ListyMarket for 30 days. Add a caption to also appear in Agent posts.',
        )
      }

      if (socials.length > 0) {
        const files = await Promise.all(
          chosen.map(async (img, i) => {
            const res = await fetch(img.publicUrl)
            if (!res.ok) throw new Error('Could not load one of the photos.')
            const blob = await res.blob()
            const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
            return new File([blob], `listing-${i + 1}.${ext}`, { type: blob.type || 'image/jpeg' })
          }),
        )

        if (mobile && navigator.canShare?.({ files })) {
          try {
            await navigator.share({ files, text: caption, title: property.title })
            for (const c of socials) logged.push({ channel: c.id, status: 'shared' })
            notes.push('Shared. Pick Facebook, Instagram or TikTok in the share sheet for each one you want.')
          } catch (err) {
            if (!(err instanceof DOMException && err.name === 'AbortError')) throw err
            notes.push('Social sharing was cancelled.')
          }
        } else {
          try {
            await navigator.clipboard.writeText(caption)
            notes.push('Caption copied.')
          } catch {
            notes.push('Could not copy the caption automatically. Copy it from the box above.')
          }
          files.forEach((f, i) => {
            setTimeout(() => {
              const url = URL.createObjectURL(f)
              const a = document.createElement('a')
              a.href = url
              a.download = f.name
              document.body.appendChild(a)
              a.click()
              a.remove()
              setTimeout(() => URL.revokeObjectURL(url), 2000)
            }, i * 350)
          })
          notes.push(`${files.length} photo${files.length === 1 ? '' : 's'} downloading. In each tab, create a post, attach the photos and paste the caption.`)
          if (blockedTabs) notes.push('Your browser blocked some tabs. Allow pop-ups for this site, or open the apps yourself.')
          for (const c of socials) logged.push({ channel: c.id, status: 'shared' })
        }
      }

      if (logged.length > 0) {
        const { error: logErr } = await supabase.from('social_posts').insert(
          logged.map((l) => ({
            agent_id: property.agent_id,
            property_id: property.id,
            channel: l.channel,
            status: l.status,
            caption: caption.slice(0, 2000) || null,
            image_count: chosen.length,
          })),
        )
        if (logErr) notes.push('Published, but the history could not be saved.')
      }
      setMessage(notes.join(' '))
      onPublished?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <strong style={{ color: 'var(--heading)' }}>1. Photos</strong>
        {imagesLoading ? (
          <p className="muted">Loading photos…</p>
        ) : images.length === 0 ? (
          <p className="muted" style={{ margin: '6px 0 0' }}>No photos on this property yet. Add photos on the property page first.</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {images.map((img) => {
              const on = selectedIds.has(img.id)
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => toggleImage(img.id)}
                  aria-pressed={on}
                  style={{
                    padding: 0,
                    border: on ? '3px solid var(--blue)' : '3px solid transparent',
                    borderRadius: 12,
                    overflow: 'hidden',
                    opacity: on ? 1 : 0.45,
                    cursor: 'pointer',
                    width: 84,
                    height: 64,
                    background: '#e8eef7',
                  }}
                >
                  <img src={img.publicUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              )
            })}
          </div>
        )}
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>{chosen.length} selected (max {MAX_PHOTOS}). Tap to include or leave out.</p>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ color: 'var(--heading)' }}>2. Caption</strong>
          {canGenerate && (
            <button type="button" className="btn btn-sm" onClick={() => void generateCaption()} disabled={generating}>
              {generating ? 'Writing…' : 'Write with AI'}
            </button>
          )}
        </div>
        <textarea
          className="textarea"
          style={{ marginTop: 8, minHeight: 120 }}
          value={caption}
          maxLength={2200}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption, or generate one in the Marketing studio and it appears here."
        />
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>{caption.length}/2200</p>
      </div>

      <div>
        <strong style={{ color: 'var(--heading)' }}>3. Where to publish</strong>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {CHANNELS.map((c) => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={channels.has(c.id)} onChange={() => toggleChannel(c.id)} style={{ marginTop: 4 }} />
              <span>
                <strong style={{ color: 'var(--heading)' }}>{c.label}</strong>
                <span className="muted" style={{ display: 'block', fontSize: 12 }}>{c.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner" style={{ background: '#e8f8ef', color: '#0b6b3a', borderRadius: 12, padding: 12, fontWeight: 600 }}>{message}</div>}

      <button type="button" className="btn btn-blue btn-lg" onClick={() => void publish()} disabled={busy}>
        {busy ? 'Publishing…' : 'Publish'}
      </button>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        ListyMarket publishes instantly. Facebook, Instagram and TikTok open with your photos and caption ready, and you tap Post there. Automatic posting needs each platform's approval and is not included yet.
      </p>
    </div>
  )
}
