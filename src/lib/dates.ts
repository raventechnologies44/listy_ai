export function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfLocalDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export type FollowUpBucket = 'overdue' | 'today' | 'upcoming'

export function bucketFollowUp(iso: string | null, now = new Date()): FollowUpBucket | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const start = startOfLocalDay(now).getTime()
  const end = endOfLocalDay(now).getTime()
  if (t < start) return 'overdue'
  if (t <= end) return 'today'
  return 'upcoming'
}

export function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalDatetimeInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
