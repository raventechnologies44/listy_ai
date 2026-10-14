import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

if (!supabaseConfigured) {
  console.warn(
    'ListyAI: Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local',
  )
}

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export const PROPERTY_IMAGES_BUCKET = 'property-images'

export function getPublicImageUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .getPublicUrl(storagePath)
  return data.publicUrl
}
