export function isTireIncludedInAnalytics(tire: {
  quantity?: number | string | null
}): boolean {
  return Number(tire.quantity) > 0
}
