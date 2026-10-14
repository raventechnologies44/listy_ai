import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AgentSchedule, ScheduleInsert, ScheduleUpdate } from '../types/database'

export function useSchedules(agentId: string | undefined) {
  const [schedules, setSchedules] = useState<AgentSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!agentId) {
      setSchedules([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('agent_schedules')
      .select('*')
      .eq('agent_id', agentId)
      .order('scheduled_at', { ascending: true })

    setLoading(false)
    if (err) {
      setError(err.message)
      setSchedules([])
      return
    }
    setSchedules((data ?? []) as AgentSchedule[])
  }, [agentId])

  useEffect(() => {
    void load()
  }, [load])

  return { schedules, loading, error, reload: load }
}

export async function createSchedule(
  agentId: string,
  payload: Omit<ScheduleInsert, 'agent_id'>,
): Promise<{ data: AgentSchedule | null; error: string | null }> {
  const { data, error } = await supabase
    .from('agent_schedules')
    .insert({ ...payload, agent_id: agentId })
    .select()
    .single()
  return { data: data as AgentSchedule | null, error: error?.message ?? null }
}

export async function updateSchedule(
  id: string,
  agentId: string,
  payload: ScheduleUpdate,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('agent_schedules')
    .update(payload)
    .eq('id', id)
    .eq('agent_id', agentId)
  return { error: error?.message ?? null }
}

export async function deleteSchedule(
  id: string,
  agentId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('agent_schedules').delete().eq('id', id).eq('agent_id', agentId)
  return { error: error?.message ?? null }
}
