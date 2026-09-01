export const rupiah = (amount: number, compact = false) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
    compactDisplay: 'short',
  }).format(amount)

export const percent = (value: number) => `${Math.round(value)}%`

export const initials = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()

export const daysUntil = (date: string) => {
  const now = new Date()
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  const due = new Date(`${date}T12:00:00`)
  return Math.round((due.getTime() - current.getTime()) / 86_400_000)
}

export const deadlineLabel = (date: string) => {
  const days = daysUntil(date)
  if (days < 0) return `Terlambat ${Math.abs(days)} hari`
  if (days === 0) return 'Jatuh tempo hari ini'
  if (days === 1) return 'Besok'
  return `${days} hari lagi`
}
