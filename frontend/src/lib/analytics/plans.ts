export type CheckoutPlanId = 'starter' | 'premium' | 'annual'

export type AnalyticsPlanItem = {
  item_id: CheckoutPlanId
  item_name: string
  price: number
  quantity: 1
}

/** Major-unit EUR prices matching Viva order amounts (cents / 100). */
export const ANALYTICS_CHECKOUT_PLANS: Record<
  CheckoutPlanId,
  { item_id: CheckoutPlanId; item_name: string; price: number }
> = {
  starter: { item_id: 'starter', item_name: 'Starter', price: 19 },
  premium: { item_id: 'premium', item_name: 'Premium', price: 39 },
  annual: { item_id: 'annual', item_name: 'Annual Premium', price: 199 },
}

export function analyticsPlanItem(
  plan: string,
  /** Optional override from backend amount (cents). */
  amountCents?: number,
): AnalyticsPlanItem | null {
  const key = (plan || '').trim().toLowerCase() as CheckoutPlanId
  const base = ANALYTICS_CHECKOUT_PLANS[key]
  if (!base) return null
  const price =
    typeof amountCents === 'number' && Number.isFinite(amountCents) && amountCents >= 0
      ? Math.round(amountCents) / 100
      : base.price
  return { ...base, price, quantity: 1 }
}
