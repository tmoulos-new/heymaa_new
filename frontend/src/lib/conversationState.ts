/** Lightweight continuity blob sent with /chat (mirrors backend conversation_state). */

export type ConversationState = {
  current_topic?: string | null
  current_concern?: string | null
  important_facts?: string[]
  advice_given?: string[]
  rejected_advice?: string[]
  user_corrections?: string[]
  unresolved_questions?: string[]
  emotional_context?: string | null
}

export function emptyConversationState(): ConversationState {
  return {
    current_topic: null,
    current_concern: null,
    important_facts: [],
    advice_given: [],
    rejected_advice: [],
    user_corrections: [],
    unresolved_questions: [],
    emotional_context: null,
  }
}

export function normalizeConversationState(raw: unknown): ConversationState {
  const base = emptyConversationState()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const clip = (v: unknown, n = 160) => {
    const s = String(v || '').replace(/\s+/g, ' ').trim()
    return s.length > n ? `${s.slice(0, n - 1)}…` : s
  }
  const list = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map((x) => clip(x)).filter(Boolean).slice(0, 8)
    if (typeof v === 'string' && v.trim()) return [clip(v)]
    return []
  }
  return {
    current_topic: clip(o.current_topic, 120) || null,
    current_concern: clip(o.current_concern, 120) || null,
    important_facts: list(o.important_facts),
    advice_given: list(o.advice_given),
    rejected_advice: list(o.rejected_advice),
    user_corrections: list(o.user_corrections),
    unresolved_questions: list(o.unresolved_questions),
    emotional_context: clip(o.emotional_context, 40) || null,
  }
}
