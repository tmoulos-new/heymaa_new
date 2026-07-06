/** Keys persisted in Supabase `user_data` (mirrors the consumer app). */
export const USER_DATA_KEYS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧' },
  { id: 'memories', label: 'Memories', icon: '🤍' },
  { id: 'milestones_map', label: 'Milestones', icon: '🏆' },
  { id: 'threads', label: 'Threads', icon: '🧵' },
  { id: 'docs', label: 'Docs', icon: '📄' },
  { id: 'shopitems', label: 'Shopping', icon: '🛍️' },
  { id: 'superitems', label: 'Supermarket', icon: '🛒' },
  { id: 'ttsused', label: 'TTS usage', icon: '🔊' },
  { id: 'phone', label: 'Phone', icon: '📱' },
] as const

export type UserDataKeyId = (typeof USER_DATA_KEYS)[number]['id']

export const USER_DATA_KEY_IDS = new Set<string>(USER_DATA_KEYS.map((k) => k.id))

export function userDataKeyLabel(id: string): string {
  return USER_DATA_KEYS.find((k) => k.id === id)?.label ?? id.replace(/_/g, ' ')
}

export function userDataKeyIcon(id: string): string {
  return USER_DATA_KEYS.find((k) => k.id === id)?.icon ?? '📦'
}

/** Tab order: known keys first, then any extra keys from the DB. */
export function orderedUserDataKeys(keys: string[]): string[] {
  const known = USER_DATA_KEYS.map((k) => k.id).filter((id) => keys.includes(id))
  const extra = keys.filter((k) => !USER_DATA_KEY_IDS.has(k)).sort()
  return [...known, ...extra]
}
