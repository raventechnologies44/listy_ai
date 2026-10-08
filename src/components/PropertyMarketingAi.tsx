import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { requestAiGeneration } from '../lib/ai'
import { canAccessFeature, getPlan, type FeatureKey } from '../lib/plans'
import type { AiMarketingTask, Property } from '../types/database'
import { AiOutputBlock } from './AiOutputBlock'
import { FeatureGate } from './FeatureGate'

const TASKS: { task: AiMarketingTask; label: string; feature: FeatureKey }[] = [
  { task: 'property_description', label: 'Property description', feature: 'ai_property_description' },
  { task: 'whatsapp_ad', label: 'WhatsApp advert', feature: 'ai_whatsapp_marketing' },
  { task: 'social_caption', label: 'Social media caption', feature: 'ai_social_marketing' },
  { task: 'hashtags', label: 'Hashtags', feature: 'ai_social_marketing' },
  { task: 'video_script', label: 'Short video script', feature: 'ai_video_scripts' },
]

export function PropertyMarketingAi({ property }: { property: Property }) {
  const { profile } = useAuth()
  const plan = getPlan(profile)
  const [outputs, setOutputs] = useState<Record<AiMarketingTask, string>>({
    property_description: '',
    whatsapp_ad: '',
    social_caption: '',
    hashtags: '',
    video_script: '',
  })
  const [errors, setErrors] = useState<Partial<Record<AiMarketingTask, string>>>({})
  const [loadingTask, setLoadingTask] = useState<AiMarketingTask | null>(null)

  async function generate(task: AiMarketingTask) {
    setLoadingTask(task)
    setErrors((e) => ({ ...e, [task]: undefined }))
    const { text, error } = await requestAiGeneration({
      task,
      property,
      agentName: profile?.full_name,
    })
    setLoadingTask(null)
    if (error) {
      setErrors((e) => ({ ...e, [task]: error }))
      return
    }
    if (text) setOutputs((o) => ({ ...o, [task]: text }))
  }

  return (
    <div className="card pad ai-marketing-card" style={{ marginTop: 12 }}>
      <div className="ai-section-heading">
        <div>
          <span className="eyebrow">AI ASSISTANT</span>
          <h3>Marketing studio</h3>
          <p>Generate editable marketing content from this listing. Nothing is published automatically.</p>
        </div>
        <span className="ai-plan-badge">{getPlan(profile).toUpperCase()}</span>
      </div>
      <div className="ai-task-grid">
        {TASKS.map(({ task, label, feature }) => (
          canAccessFeature(plan, feature) ? (
            <AiOutputBlock
              key={task}
              label={label}
              value={outputs[task]}
              onChange={(v) => setOutputs((o) => ({ ...o, [task]: v }))}
              onGenerate={() => void generate(task)}
              generating={loadingTask === task}
              error={errors[task] ?? null}
            />
          ) : (
            <div key={task} className="ai-locked-task">
              <strong>{label}</strong>
              <span>Professional & Agency</span>
              <FeatureGate feature={feature} compact />
            </div>
          )
        ))}
      </div>
    </div>
  )
}
