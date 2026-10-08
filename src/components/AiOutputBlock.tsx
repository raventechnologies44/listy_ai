import { useState } from 'react'

export function AiOutputBlock({
  label,
  value,
  onChange,
  onGenerate,
  generating,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onGenerate: () => void
  generating: boolean
  error: string | null
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="field" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label className="label" style={{ margin: 0 }}>
          {label}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-blue" disabled={generating} onClick={() => void onGenerate()}>
            {generating ? 'Generating…' : value ? 'Regenerate' : 'Generate'}
          </button>
          <button type="button" className="btn" disabled={!value} onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {error && (
        <div className="error-banner" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      <textarea
        className="textarea"
        rows={6}
        style={{ marginTop: 8 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Generated content appears here. Edit before you use it — nothing is saved to the property automatically."
      />
    </div>
  )
}
