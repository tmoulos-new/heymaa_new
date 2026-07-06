const IGNORE_DIFF_KEYS = new Set(['updated_at'])

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => valuesEqual(v, b[i]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ao = a as Record<string, unknown>
    const bo = b as Record<string, unknown>
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)])
    return [...keys].every((k) => valuesEqual(ao[k], bo[k]))
  }
  return false
}

export function diffSnapshots(
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  if (!before && !after) {
    return { before: {}, after: {} }
  }
  if (!before && after) {
    return { before: {}, after: { ...after } }
  }
  if (before && !after) {
    return { before: { ...before }, after: {} }
  }

  const b = before!
  const a = after!
  const keys = new Set([...Object.keys(b), ...Object.keys(a)])
  const beforeOut: Record<string, unknown> = {}
  const afterOut: Record<string, unknown> = {}

  for (const key of keys) {
    if (IGNORE_DIFF_KEYS.has(key)) continue
    if (!valuesEqual(b[key], a[key])) {
      if (key in b) beforeOut[key] = b[key]
      if (key in a) afterOut[key] = a[key]
    }
  }

  return { before: beforeOut, after: afterOut }
}
