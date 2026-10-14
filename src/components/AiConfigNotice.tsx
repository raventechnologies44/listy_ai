import { useAiConfigured } from '../hooks/useAiConfigured'

export function AiConfigNotice() {
  const { configured, loading } = useAiConfigured()
  if (loading || configured) return null
  return (
    <div className="info-banner" style={{ marginBottom: 12 }}>
      AI not configured. Add <code>ANTHROPIC_API_KEY</code> to <code>.env.local</code> (local) or Vercel env
      (production), then restart the dev server.
    </div>
  )
}
