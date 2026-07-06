/** Normalize a user_data value (jsonb object or JSON string) for display. */
export function parseUserDataValue(raw: unknown): unknown {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
      return JSON.parse(trimmed)
    } catch {
      return raw
    }
  }
  return raw
}

export function formatUserDataJson(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
