export function formatCurrency(amount: number, listingType: 'sale' | 'rent'): string {
  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
  return listingType === 'rent' ? `${formatted}/mo` : formatted
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function userInitials(nameOrEmail: string | null | undefined): string {
  const s = (nameOrEmail ?? '').trim()
  if (!s) return 'A'
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return (parts[0][0] + (parts[0][1] ?? 'A')).toUpperCase()
  }
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}
