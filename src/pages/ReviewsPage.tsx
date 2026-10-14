import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { averageRating, Stars, type AgentReview } from '../market/marketApi'
import '../market/market.css'

export function ReviewsPage() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<AgentReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data, error: err } = await supabase
        .from('agent_reviews_public')
        .select('*')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false })
      if (err) setError(err.message)
      setReviews((data ?? []) as AgentReview[])
      setLoading(false)
    })()
  }, [user])

  if (loading) return <LoadingSpinner />
  const avg = averageRating(reviews)

  return (
    <div>
      <h2 className="page-title" style={{ margin: '0 0 6px' }}>Reviews</h2>
      <p className="muted" style={{ margin: '0 0 16px' }}>
        Reviews from customers who enquired through ListyMarket.{' '}
        {user && <Link to={`/market/agent/${user.id}`} target="_blank" style={{ fontWeight: 700 }}>View your public page</Link>}
      </p>
      {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="card pad" style={{ marginBottom: 12 }}>
        {reviews.length > 0 ? (
          <><Stars value={avg} /> <strong style={{ color: 'var(--heading)' }}>{avg.toFixed(1)}</strong> <span className="muted">from {reviews.length} review{reviews.length === 1 ? '' : 's'}</span></>
        ) : (
          <span className="muted">No reviews yet. Customers can review you after they send an enquiry.</span>
        )}
      </div>
      {reviews.map((r) => (
        <div className="card pad" key={r.id} style={{ marginBottom: 10 }}>
          <Stars value={r.rating} /> <strong style={{ color: 'var(--heading)' }}>{r.reviewer_name}</strong>
          <span className="muted" style={{ fontSize: 12 }}> · {new Date(r.created_at).toLocaleDateString()}</span>
          {r.comment && <p style={{ margin: '6px 0 0' }}>{r.comment}</p>}
        </div>
      ))}
    </div>
  )
}
