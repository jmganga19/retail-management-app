export const parseNumericLike = (value: string | undefined, fallback = NaN): number => {
  if (value == null) return fallback
  const cleaned = String(value).replace(/,/g, '').trim()
  if (!cleaned) return fallback
  const parsed = Number(cleaned)
  return Number.isNaN(parsed) ? fallback : parsed
}

export const parsePositiveIntLike = (value: string | undefined, fallback = NaN): number => {
  const parsed = parseNumericLike(value, fallback)
  if (!Number.isFinite(parsed)) return fallback
  const integer = Math.trunc(parsed)
  return integer > 0 ? integer : fallback
}

export const trimToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const normalizePaymentMethod = (value: string | undefined): 'cash' | 'card' | 'mobile_money' => {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (normalized === 'card') return 'card'
  if (normalized === 'mobile_money') return 'mobile_money'
  return 'cash'
}
