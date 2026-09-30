import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useAiConfigured() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        if (!cancelled) {
          setConfigured(false)
          setLoading(false)
        }
        return
      }
      try {
        const res = await fetch('/api/ai/status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = (await res.json()) as { configured?: boolean }
        if (!cancelled) {
          setConfigured(Boolean(json.configured))
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setConfigured(false)
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { configured, loading }
}
