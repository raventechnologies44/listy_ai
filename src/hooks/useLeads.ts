import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Lead, LeadInsert, LeadUpdate } from '../types/database'

export function useLeads(agentId: string | undefined) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!agentId) {
      setLeads([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('leads')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })

    setLoading(false)
    if (err) {
      setError(err.message)
      setLeads([])
      return
    }
    setLeads((data ?? []) as Lead[])
  }, [agentId])

  useEffect(() => {
    void load()
  }, [load])

  return { leads, loading, error, reload: load }
}

export function useLead(leadId: string | undefined, agentId: string | undefined) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!leadId || !agentId) {
      setLead(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('agent_id', agentId)
      .maybeSingle()

    setLoading(false)
    if (err) {
      setError(err.message)
      setLead(null)
      return
    }
    setLead(data as Lead | null)
  }, [leadId, agentId])

  useEffect(() => {
    void load()
  }, [load])

  return { lead, loading, error, reload: load }
}

export async function createLead(
  agentId: string,
  payload: Omit<LeadInsert, 'agent_id'>,
): Promise<{ data: Lead | null; error: string | null }> {
  const { data, error } = await supabase
    .from('leads')
    .insert({ ...payload, agent_id: agentId })
    .select()
    .single()
  return { data: data as Lead | null, error: error?.message ?? null }
}

export async function updateLead(
  leadId: string,
  agentId: string,
  payload: LeadUpdate,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('leads').update(payload).eq('id', leadId).eq('agent_id', agentId)
  return { error: error?.message ?? null }
}

export async function deleteLead(
  leadId: string,
  agentId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('leads').delete().eq('id', leadId).eq('agent_id', agentId)
  return { error: error?.message ?? null }
}
