export type VivaPlanKey = 'starter' | 'premium' | 'annual'

/** Map pricing card variant to Viva plan key. */
export function vivaPlanForVariant(variant: string): VivaPlanKey | null {
  if (variant === 'current') return null
  if (variant === 'popular') return 'premium'
  if (variant === 'best') return 'annual'
  return 'starter'
}

export function goToVivaCheckout(plan: VivaPlanKey): void {
  window.location.href = `/checkout?plan=${encodeURIComponent(plan)}`
}
