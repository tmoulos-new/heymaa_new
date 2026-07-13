const LS_CHECKOUT_BASE = 'https://vdarpp.lemonsqueezy.com/checkout/buy/'

export const LS_VARIANT_MAP = {
  starter: 'fbf97ee8-69f2-4e90-8bf2-05b7634ad8a7',
  popular: '620b15f2-812c-4c32-8abc-c0c2c03ae1c6',
  best: '43fb54d3-619e-4006-87f6-d0856e9351b2',
} as const

export type LemonProductKey = keyof typeof LS_VARIANT_MAP

/** Map pricing card variant to Lemon Squeezy product key. */
export function productKeyForVariant(variant: string): LemonProductKey | null {
  if (variant === 'current') return null
  if (variant === 'popular') return 'popular'
  if (variant === 'best') return 'best'
  return 'starter'
}

export function openLemonCheckout(product: LemonProductKey): void {
  const variantId = LS_VARIANT_MAP[product]
  if (!variantId) return
  window.open(`${LS_CHECKOUT_BASE}${variantId}`, '_blank', 'noopener,noreferrer')
}
