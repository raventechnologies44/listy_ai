import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AgentPostCard } from './AgentPostCard'
import type { PublishedListing } from './marketApi'

export function PostsPage() {
  const [posts, setPosts] = useState<PublishedListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error: err } = await supabase
        .from('published_listings')
        .select('*')
        .not('post_caption', 'is', null)
        .order('published_at', { ascending: false })
        .limit(40)
      if (cancelled) return
      if (err) setError(err.message)
      setPosts((data ?? []) as PublishedListing[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <h2 className="page-title" style={{ margin: '0 0 6px' }}>Agent posts</h2>
      <p className="muted" style={{ margin: '0 0 18px' }}>
        Latest properties posted by agents. Write a message under any post to contact the agent directly.
      </p>
      {error && <div className="mk-err" style={{ marginBottom: 12 }}>{error}</div>}
      {loading ? (
        <p className="muted">Loading posts…</p>
      ) : posts.length === 0 ? (
        <div className="mk-empty">
          <strong style={{ color: 'var(--heading)' }}>No posts yet</strong>
          <p className="muted" style={{ margin: '6px 0 0' }}>Agents publish posts from their Publish page. Check back soon.</p>
        </div>
      ) : (
        <div className="mk-feed">
          {posts.map((p) => (
            <AgentPostCard key={p.property_id} post={p} />
          ))}
        </div>
      )}
    </div>
  )
}
