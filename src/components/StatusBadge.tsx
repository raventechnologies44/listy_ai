import type { PropertyStatus } from '../types/database'
import { statusLabel } from '../lib/format'

export function StatusBadge({ status }: { status: PropertyStatus }) {
  return <span className={`badge badge-${status}`}>{statusLabel(status)}</span>
}
