import type { UserDataSummary } from './types'

export type UserDataSummaryItem = {
  key: keyof UserDataSummary
  label: string
}

export function userDataSummaryItems(summary?: UserDataSummary | null): UserDataSummaryItem[] {
  if (!summary) return []
  const items: UserDataSummaryItem[] = []
  if (summary.children > 0) {
    items.push({
      key: 'children',
      label: `${summary.children} ${summary.children === 1 ? 'child' : 'children'}`,
    })
  }
  if (summary.members > 0) {
    items.push({
      key: 'members',
      label: `${summary.members} ${summary.members === 1 ? 'member' : 'members'}`,
    })
  }
  if (summary.chat_messages > 0) {
    items.push({ key: 'chat_messages', label: `${summary.chat_messages} chat` })
  }
  if (summary.memories > 0) {
    items.push({
      key: 'memories',
      label: `${summary.memories} ${summary.memories === 1 ? 'memory' : 'memories'}`,
    })
  }
  if (summary.threads > 0) {
    items.push({
      key: 'threads',
      label: `${summary.threads} ${summary.threads === 1 ? 'thread' : 'threads'}`,
    })
  }
  return items
}

export function formatUserDataSummary(summary?: UserDataSummary | null): string[] {
  return userDataSummaryItems(summary).map((item) => item.label)
}

export function hasUserDataSummary(summary?: UserDataSummary | null): boolean {
  return formatUserDataSummary(summary).length > 0
}
