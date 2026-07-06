import type { UserDataSummary } from './types'

export function formatUserDataSummary(summary?: UserDataSummary | null): string[] {
  if (!summary) return []
  const parts: string[] = []
  if (summary.children > 0) {
    parts.push(`${summary.children} ${summary.children === 1 ? 'child' : 'children'}`)
  }
  if (summary.members > 0) {
    parts.push(`${summary.members} ${summary.members === 1 ? 'member' : 'members'}`)
  }
  if (summary.chat_messages > 0) {
    parts.push(`${summary.chat_messages} chat`)
  }
  if (summary.memories > 0) {
    parts.push(`${summary.memories} ${summary.memories === 1 ? 'memory' : 'memories'}`)
  }
  if (summary.threads > 0) {
    parts.push(`${summary.threads} ${summary.threads === 1 ? 'thread' : 'threads'}`)
  }
  return parts
}

export function hasUserDataSummary(summary?: UserDataSummary | null): boolean {
  return formatUserDataSummary(summary).length > 0
}
