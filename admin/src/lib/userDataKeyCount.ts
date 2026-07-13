import { parseUserDataValue } from './parseUserDataValue'

/** Number of records/items stored under a user_data key (for tab badges). */
export function userDataKeyCount(keyId: string, raw: unknown): number {
  const parsed = parseUserDataValue(raw)
  if (parsed == null) return 0

  switch (keyId) {
    case 'family': {
      if (Array.isArray(parsed)) return parsed.length
      if (typeof parsed === 'object') {
        const o = parsed as { children?: unknown[]; members?: unknown[] }
        const children = Array.isArray(o.children) ? o.children.length : 0
        const members = Array.isArray(o.members) ? o.members.length : 0
        return children + members
      }
      return 0
    }
    case 'milestones_map': {
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.values(parsed as Record<string, unknown>).filter(Boolean).length
      }
      return 0
    }
    case 'chat':
    case 'memories':
    case 'threads':
    case 'docs':
    case 'shopitems':
    case 'superitems':
      return Array.isArray(parsed) ? parsed.length : 0
    case 'ttsused':
    case 'phone':
      return parsed ? 1 : 0
    default:
      if (Array.isArray(parsed)) return parsed.length
      if (typeof parsed === 'object') return Object.keys(parsed).length
      return 1
  }
}
