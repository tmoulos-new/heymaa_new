/** Build a Past-conversation title from the whole thread, not only the first user line. */

const MAX_TITLE_LEN = 64

/** Whole-message chitchat / ack — not useful as an archive title. */
const TRIVIAL_RE =
  /^(hi|hello|hey|γεια σου|γεια|γειά σου|γειά|καλημέρα|καλησπέρα|καλημερα|καλησπερα|χαίρετε|τι κάνεις|τι κανεις|πώς είσαι|πως είσαι|πως εισαι|πώς εισαι|how are you|how's it going|how are you doing|thanks|thank you|ευχαριστώ|ευχαριστω|ok|okay|ωραία|ωραια|εντάξει|ενταξει|ναι|όχι|οχι|yes|no|yep|nope|bye|goodbye|αντίο|αντιο|τα λέμε|τα λεμε|lol|haha|χαχα)\s*[!?.…;]*$/iu

/** Soft signals that a line is about parenting / the real topic. */
const TOPIC_BOOST_RE =
  /\b(sleep|nap|feed|breast|formula|solid|teething|fever|rash|pregnan|trimester|milestone|vaccin|colic|diaper|nappy|ύπν|θηλασμ|γάλα|στερε|οδοντοφυ|πυρετ|εξάνθη|εξανθη|εγκυμοσ|τρίμηνο|τριμηνο|ορόσημ|οροσημ|εμβόλι|εμβολι|κωλικ|πάνα|πανα|μωρό|μωρο|βρέφος|βρεφος|παιδί|παιδι)\w*/iu

export type TitleMessage = {
  role?: string
  content?: string
}

function cleanLine(raw: string): string {
  return (raw || "").replace(/\s+/g, " ").trim()
}

function isTrivial(text: string): boolean {
  const t = cleanLine(text)
  if (!t) return true
  if (t.length <= 2) return true
  return TRIVIAL_RE.test(t)
}

function scoreUserLine(text: string, indexAmongSubstantive: number, totalSubstantive: number): number {
  const t = cleanLine(text)
  let score = Math.min(t.length, 180)
  if (/[?;？]/.test(t) || /\b(πώς|πως|τι|πότε|ποτε|γιατί|γιατι|how|what|when|why|should)\b/iu.test(t)) {
    score += 24
  }
  if (TOPIC_BOOST_RE.test(t)) score += 40
  // Prefer later substantive turns slightly — the conversation often lands on the real topic after a hello.
  if (totalSubstantive > 1) {
    score += Math.round((indexAmongSubstantive / (totalSubstantive - 1)) * 18)
  }
  // Very short leftover lines after trivial filter still lose to richer ones
  if (t.length < 18) score -= 20
  return score
}

function clipTitle(text: string, fallback: string): string {
  const t = cleanLine(text) || fallback
  if (!t) return fallback
  if (t.length <= MAX_TITLE_LEN) return t
  const cut = t.slice(0, MAX_TITLE_LEN - 1)
  const atSpace = cut.lastIndexOf(" ")
  const base = atSpace > 24 ? cut.slice(0, atSpace) : cut
  return `${base.replace(/[,:;–-]+$/u, "").trim()}…`
}

/**
 * Name an archived chat from the conversation as a whole.
 * Skips greetings / thanks, scores substantive user turns (topic keywords, questions, length),
 * and falls back to a meaningful assistant line if the user only said hello.
 */
export function titleFromConversation(
  msgs: TitleMessage[] | null | undefined,
  fallback: string,
): string {
  const list = Array.isArray(msgs) ? msgs : []
  const userLines = list
    .filter((m) => (m?.role || "") === "user")
    .map((m) => cleanLine(m?.content || ""))
    .filter(Boolean)

  const substantive = userLines.filter((t) => !isTrivial(t))
  if (substantive.length) {
    let best = substantive[0]
    let bestScore = Number.NEGATIVE_INFINITY
    substantive.forEach((t, i) => {
      const s = scoreUserLine(t, i, substantive.length)
      if (s >= bestScore) {
        bestScore = s
        best = t
      }
    })
    return clipTitle(best, fallback)
  }

  // No substantive user text — try a non-greeting assistant reply (still better than "Hi").
  const assistant = list
    .filter((m) => (m?.role || "") === "assistant")
    .map((m) => cleanLine(m?.content || ""))
    .find((t) => t && !isTrivial(t) && t.length >= 12)
  if (assistant) return clipTitle(assistant, fallback)

  const anyUser = userLines[0]
  if (anyUser) return clipTitle(anyUser, fallback)

  const any = list.map((m) => cleanLine(m?.content || "")).find(Boolean)
  return clipTitle(any || "", fallback)
}
