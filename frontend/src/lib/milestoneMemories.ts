import type { AppMemory } from './memoryTypes'

export function milestoneMemoryKey(ref: string, idx: number): string {
  return `${ref}:${idx}`
}

export function emojiForMilestoneLabel(label: string): string {
  const l = label.toLowerCase()
  if (/δοντ|tooth|teeth|δοντάκ/.test(l)) return '🦷'
  if (/χαμογ|smil|γελ/.test(l)) return '😊'
  if (/βήμα|walk|step|περπ|crawl|κρύβ/.test(l)) return '🚶'
  if (/μπάνι|bath/.test(l)) return '🛁'
  if (/μίλ|speak|word|λέξ|talk|babbl|γου|mama|papa/.test(l)) return '👶'
  if (/κοιμ|sleep/.test(l)) return '😴'
  return '🏆'
}

export function buildMilestoneMemory(params: {
  ref: string
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
    milestoneKey: milestoneMemoryKey(params.ref, params.idx),
    description:
      params.lang === 'el'
        ? 'Καταχωρήθηκε από το tab Ορόσημα.'
        : 'Logged from the Milestones tab.',
  }
}
