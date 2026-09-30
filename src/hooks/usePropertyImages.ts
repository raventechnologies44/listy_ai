import { useCallback, useEffect, useState } from 'react'
import { getPublicImageUrl, PROPERTY_IMAGES_BUCKET, supabase } from '../lib/supabase'
import type { PropertyImage } from '../types/database'

export interface PropertyImageWithUrl extends PropertyImage {
  publicUrl: string
}

export function usePropertyImages(propertyId: string | undefined, agentId: string | undefined) {
  const [images, setImages] = useState<PropertyImageWithUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!propertyId || !agentId) {
      setImages([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('property_images')
      .select('*')
      .eq('property_id', propertyId)
      .eq('agent_id', agentId)
      .order('sort_order', { ascending: true })

    setLoading(false)
    if (err) {
      setError(err.message)
      setImages([])
      return
    }
    const rows = (data ?? []) as PropertyImage[]
    setImages(
      rows.map((row) => ({
        ...row,
        publicUrl: getPublicImageUrl(row.storage_path),
      })),
    )
  }, [propertyId, agentId])

  useEffect(() => {
    void load()
  }, [load])

  return { images, loading, error, reload: load }
}

export async function uploadPropertyImage(
  agentId: string,
  propertyId: string,
  file: File,
  sortOrder: number,
): Promise<{ error: string | null }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeName = `${crypto.randomUUID()}.${ext}`
  const storagePath = `${agentId}/${propertyId}/${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { error: dbError } = await supabase.from('property_images').insert({
    property_id: propertyId,
    agent_id: agentId,
    storage_path: storagePath,
    sort_order: sortOrder,
  })

  if (dbError) {
    await supabase.storage.from(PROPERTY_IMAGES_BUCKET).remove([storagePath])
    return { error: dbError.message }
  }

  return { error: null }
}

export async function deletePropertyImage(
  image: PropertyImage,
): Promise<{ error: string | null }> {
  const { error: storageError } = await supabase.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .remove([image.storage_path])

  if (storageError) return { error: storageError.message }

  const { error: dbError } = await supabase
    .from('property_images')
    .delete()
    .eq('id', image.id)

  return { error: dbError?.message ?? null }
}
