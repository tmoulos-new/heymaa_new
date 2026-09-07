import type { HomePlanFeature } from '../i18n/homeTypes'

export function normalizePlanFeatures(raw: unknown): HomePlanFeature[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (typeof item === 'string') return { label: item, hint: '' }
    if (item && typeof item === 'object' && 'label' in item) {
      const row = item as { label?: unknown; hint?: unknown }
      return {
        label: String(row.label ?? ''),
        hint: row.hint != null ? String(row.hint) : '',
      }
    }
    return { label: String(item), hint: '' }
  })
}

export function resolveFeatureHint(
  hints: Record<string, string> | undefined,
  hintKey: string,
): string {
  if (!hintKey || !hints) return ''
  return hints[hintKey] || ''
}
