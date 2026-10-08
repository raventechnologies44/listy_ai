import { supabase } from './supabase'
import type { AiTask, Lead, Property } from '../types/database'

export function propertyToAiPayload(property: Property) {
  return {
    title: property.title,
    description: property.description,
    property_type: property.property_type,
    listing_type: property.listing_type,
    price: property.price,
    location: property.location,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    size: property.size,
    features: property.features,
    status: property.status,
  }
}

export function leadToAiPayload(lead: Lead) {
  return {
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    budget: lead.budget,
    requirements: lead.requirements,
    notes: lead.notes,
    stage: lead.stage,
    last_contact_at: lead.last_contact_at,
    next_follow_up_at: lead.next_follow_up_at,
  }
}

export async function requestAiGeneration(params: {
  task: AiTask
  property?: Property
  lead?: Lead
  agentName?: string | null
  enquiryMessage?: string
}): Promise<{ text: string | null; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { text: null, error: 'You must be logged in to use AI.' }

  const body: Record<string, unknown> = {
    task: params.task,
    agentName: params.agentName ?? undefined,
  }
  if (params.property) body.property = propertyToAiPayload(params.property)
  if (params.lead) body.lead = leadToAiPayload(params.lead)

  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = (await res.json()) as { text?: string; error?: string }
    if (!res.ok) return { text: null, error: data.error || `Request failed (${res.status})` }
    return { text: data.text ?? null, error: data.text ? null : 'Empty response' }
  } catch {
    return { text: null, error: 'Could not reach AI service. Is the dev server running?' }
  }
}
