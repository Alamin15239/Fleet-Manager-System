export const TIRE_ANALYTICS_ORIGINS = [
  'CHINESE',
  'SAUDI',
  'JAPANESE',
  'EUROPEAN',
  'AMERICAN'
] as const

export function isTireIncludedInAnalytics(tire: {
  quantity?: number | string | null
  origin?: string | null
}): boolean {
  const origin = String(tire.origin || '').trim().toUpperCase()
  return Number(tire.quantity) > 0 && TIRE_ANALYTICS_ORIGINS.includes(origin as typeof TIRE_ANALYTICS_ORIGINS[number])
}
