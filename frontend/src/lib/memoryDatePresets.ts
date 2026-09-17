import { memoryTimestamp, toIsoDate, type BookletMemory } from './memoriesBooklet'

export type DatePreset = 'all' | 'month' | 'months3' | 'year' | 'custom'

export function datePresetRange(preset: Exclude<DatePreset, 'all' | 'custom'>): { from: string; to: string } {
  const now = new Date()
  const to = toIsoDate(now)
  if (preset === 'month') {
    return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to }
  }
  if (preset === 'months3') {
    return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to }
  }
  return { from: toIsoDate(new Date(now.getFullYear(), 0, 1)), to }
}

export function datePresetChips(el: boolean): { id: DatePreset; label: string }[] {
  return [
    { id: 'all', label: el ? 'Όλες οι ημερομηνίες' : 'All dates' },
    { id: 'month', label: el ? 'Αυτόν τον μήνα' : 'This month' },
    { id: 'months3', label: el ? '3 μήνες' : '3 months' },
    { id: 'year', label: el ? 'Φέτος' : 'This year' },
    { id: 'custom', label: el ? 'Προσαρμογή' : 'Custom' },
  ]
}

export function inferDatePreset(from: string, to: string): DatePreset {
  if (!from && !to) return 'all'
  for (const id of ['month', 'months3', 'year'] as const) {
    const range = datePresetRange(id)
    if (range.from === from && range.to === to) return id
  }
  return 'custom'
}

export function memoriesDateSpan(memories: BookletMemory[], lang: string): { from: string; to: string } {
  const to = toIsoDate(new Date())
  if (!memories.length) return { from: to, to }
  let min = Infinity
  let max = -Infinity
  memories.forEach((m, i) => {
    const ts = memoryTimestamp(m, i, memories.length, lang)
    if (ts < min) min = ts
    if (ts > max) max = ts
  })
  return { from: toIsoDate(new Date(min)), to: toIsoDate(new Date(max)) }
}
