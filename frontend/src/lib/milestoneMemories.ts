import type { AppMemory } from './memoryTypes'

export function milestoneMemoryKey(ref: string, stageId: string, idx: number): string {
  return `${ref}:${stageId}:${idx}`
}

/** Parse new or legacy milestone memory keys. */
export function parseMilestoneMemoryKey(key: string): {
  ref: string
  stageId?: string
  idx: number
} | null {
  const parts = key.split(':')
  if (parts.length === 2) {
    const idx = Number(parts[1])
    if (!Number.isFinite(idx)) return null
    return { ref: parts[0], idx }
  }
  if (parts.length >= 3) {
    const idx = Number(parts[parts.length - 1])
    if (!Number.isFinite(idx)) return null
    return {
      ref: parts[0],
      stageId: parts.slice(1, -1).join(':'),
      idx,
    }
  }
  return null
}

export function emojiForMilestoneLabel(label: string): string {
  const l = label.toLowerCase()
  if (/θάλασσ|θαλασσ|sea|beach|ocean/.test(l)) return '🌊'
  if (/στερε|solid food|wean|κουτάλ/.test(l)) return '🥣'
  if (/μπιμπ|bottle|formula/.test(l)) return '🍼'
  if (/κουδουν|rattle|παιχνίδ/.test(l)) return '🔔'
  if (/μπουσουλ|crawl/.test(l)) return '🚼'
  if (/σκάλ|stair|climb/.test(l)) return '🪜'
  if (/πύργ|tower|τουβλ|block/.test(l)) return '🧱'
  if (/πάρτ|party|γενέθλ|birthday/.test(l)) return '🎉'
  if (/δοντ|tooth|teeth|δοντάκ/.test(l)) return '🦷'
  if (/χαμογ|smil|γελ/.test(l)) return '😊'
  if (/βήμα|walk|step|περπ/.test(l)) return '🚶'
  if (/λέξ|word|speak|talk|babbl|μίλ|γου|mama|papa/.test(l)) return '💬'
  if (/μπάνι|bath/.test(l)) return '🛁'
  if (/κοιμ|sleep/.test(l)) return '😴'
  return '🚩'
}

export function milestoneDisplayEmoji(memory: {
  emoji?: string
  source?: string
  isMilestone?: boolean
}): string | undefined {
  const emoji = memory.emoji
  if (emoji === '🏆' && (memory.source === 'milestone' || memory.isMilestone)) return '🚩'
  return emoji
}

/** Rewrite legacy `ref:idx` keys to `ref:stageId:idx`; drop duplicates. */
export function migrateLegacyMilestoneMemories<T extends { milestoneKey?: string }>(
  memories: T[],
  resolveStageId: (ref: string) => string,
): T[] {
  const seen = new Set<string>()
  let changed = false
  const out: T[] = []

  for (const mem of memories) {
    const rawKey = mem.milestoneKey
    if (!rawKey) {
      out.push(mem)
      continue
    }
    const parsed = parseMilestoneMemoryKey(rawKey)
    if (!parsed) {
      out.push(mem)
      continue
    }
    const stageId = parsed.stageId ?? resolveStageId(parsed.ref)
    const newKey = milestoneMemoryKey(parsed.ref, stageId, parsed.idx)
    if (seen.has(newKey)) {
      changed = true
      continue
    }
    seen.add(newKey)
    if (newKey !== rawKey) {
      changed = true
      out.push({ ...mem, milestoneKey: newKey })
    } else {
      out.push(mem)
    }
  }

  return changed ? out : memories
}

export function buildMilestoneMemory(params: {
  ref: string
  stageId: string
  idx: number
  label: string
  lang: string
}): AppMemory {
  const memoryRef = params.ref === '__general__' ? undefined : params.ref
  const now = new Date()
  return {
    emoji: emojiForMilestoneLabel(params.label),
    text: params.label,
    date: now.toLocaleDateString(params.lang === 'el' ? 'el-GR' : params.lang, {
      day: 'numeric',
      month: 'short',
    }),
    createdAt: now.toISOString(),
    ref: memoryRef,
    source: 'milestone',
    isMilestone: true,
    milestoneKey: milestoneMemoryKey(params.ref, params.stageId, params.idx),
    description:
      params.lang === 'el'
        ? 'Καταχωρήθηκε από το tab Ορόσημα.'
        : 'Logged from the Milestones tab.',
  }
}
