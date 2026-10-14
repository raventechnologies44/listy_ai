export type Plan = 'starter' | 'professional' | 'agency'
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'pending'

export type PropertyType =
  | 'house'
  | 'apartment'
  | 'condo'
  | 'townhouse'
  | 'land'
  | 'commercial'
  | 'other'

export type ListingType = 'sale' | 'rent'

export type PropertyStatus =
  | 'available'
  | 'viewing'
  | 'negotiation'
  | 'sold'
  | 'rented'

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  brokerage: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
  subscription_plan?: Plan | null
  subscription_status?: SubscriptionStatus | null
  trial_started_at?: string | null
  trial_ends_at?: string | null
}

export interface Property {
  id: string
  agent_id: string
  title: string
  description: string | null
  property_type: PropertyType
  listing_type: ListingType
  price: number
  location: string
  bedrooms: number | null
  bathrooms: number | null
  size: number | null
  features: string[]
  status: PropertyStatus
  created_at: string
  updated_at: string
}

export interface PropertyImage {
  id: string
  property_id: string
  agent_id: string
  storage_path: string
  sort_order: number
  created_at: string
}

export type PropertyInsert = Omit<
  Property,
  'id' | 'agent_id' | 'created_at' | 'updated_at'
> & { agent_id?: string }

export type PropertyUpdate = Partial<
  Omit<Property, 'id' | 'agent_id' | 'created_at' | 'updated_at'>
>

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'other', label: 'Other' },
]

export const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: 'sale', label: 'For sale' },
  { value: 'rent', label: 'For rent' },
]

export const PROPERTY_STATUSES: { value: PropertyStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'viewing', label: 'Viewing' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'sold', label: 'Sold' },
  { value: 'rented', label: 'Rented' },
]

export const ACTIVE_STATUSES: PropertyStatus[] = [
  'available',
  'viewing',
  'negotiation',
]

export const ATTENTION_STATUSES: PropertyStatus[] = ['viewing', 'negotiation']

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'viewing'
  | 'negotiation'
  | 'closed'
  | 'lost'

export interface Lead {
  id: string
  agent_id: string
  property_id: string | null
  name: string
  phone: string | null
  email: string | null
  budget: number | null
  requirements: string | null
  notes: string | null
  stage: LeadStage
  last_contact_at: string | null
  next_follow_up_at: string | null
  created_at: string
  updated_at: string
}

export type LeadInsert = Omit<Lead, 'id' | 'agent_id' | 'created_at' | 'updated_at'> & {
  agent_id?: string
}

export type LeadUpdate = Partial<Omit<Lead, 'id' | 'agent_id' | 'created_at' | 'updated_at'>>

export const LEAD_STAGES: { value: LeadStage; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'viewing', label: 'Viewing' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed', label: 'Closed' },
  { value: 'lost', label: 'Lost' },
]

export const ACTIVE_LEAD_STAGES: LeadStage[] = [
  'contacted',
  'interested',
  'viewing',
  'negotiation',
]

export type AiMarketingTask =
  | 'property_description'
  | 'whatsapp_ad'
  | 'social_caption'
  | 'hashtags'
  | 'video_script'

export type AiTask = AiMarketingTask | 'follow_up' | 'whatsapp_reply'

export type ScheduleType = 'property_viewing' | 'follow_up_task' | 'marketing_post'

export interface AgentSchedule {
  id: string
  agent_id: string
  schedule_type: ScheduleType
  title: string
  notes: string | null
  scheduled_at: string
  property_id: string | null
  lead_id: string | null
  completed: boolean
  created_at: string
  updated_at: string
}

export type ScheduleInsert = Omit<AgentSchedule, 'id' | 'agent_id' | 'created_at' | 'updated_at'> & {
  agent_id?: string
}

export type ScheduleUpdate = Partial<
  Omit<AgentSchedule, 'id' | 'agent_id' | 'created_at' | 'updated_at'>
>

export const SCHEDULE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: 'property_viewing', label: 'Property viewing' },
  { value: 'follow_up_task', label: 'Follow-up task' },
  { value: 'marketing_post', label: 'Marketing post' },
]

export interface WhatsappEnquiry {
  id: string
  agent_id: string
  raw_message: string
  extracted_name: string | null
  extracted_phone: string | null
  extracted_email: string | null
  extracted_budget: number | null
  extracted_requirements: string | null
  lead_id: string | null
  property_id: string | null
  suggested_reply: string | null
  created_at: string
}
