import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Property, PropertyInsert, PropertyUpdate } from '../types/database'

export function useProperties(agentId: string | undefined) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!agentId) {
      setProperties([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('properties')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })

    setLoading(false)
    if (err) {
      setError(err.message)
      setProperties([])
      return
    }
    setProperties((data ?? []) as Property[])
  }, [agentId])

  useEffect(() => {
    void load()
  }, [load])

  return { properties, loading, error, reload: load }
}

export function useProperty(propertyId: string | undefined, agentId: string | undefined) {
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!propertyId || !agentId) {
      setProperty(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .eq('agent_id', agentId)
      .maybeSingle()

    setLoading(false)
    if (err) {
      setError(err.message)
      setProperty(null)
      return
    }
    setProperty(data as Property | null)
  }, [propertyId, agentId])

  useEffect(() => {
    void load()
  }, [load])

  return { property, loading, error, reload: load }
}

export async function createProperty(
  agentId: string,
  payload: Omit<PropertyInsert, 'agent_id'>,
): Promise<{ data: Property | null; error: string | null }> {
  const { data, error } = await supabase
    .from('properties')
    .insert({ ...payload, agent_id: agentId })
    .select()
    .single()

  return { data: data as Property | null, error: error?.message ?? null }
}

export async function updateProperty(
  propertyId: string,
  agentId: string,
  payload: PropertyUpdate,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('properties')
    .update(payload)
    .eq('id', propertyId)
    .eq('agent_id', agentId)

  return { error: error?.message ?? null }
}

export async function deleteProperty(
  propertyId: string,
  agentId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', propertyId)
    .eq('agent_id', agentId)

  return { error: error?.message ?? null }
}
