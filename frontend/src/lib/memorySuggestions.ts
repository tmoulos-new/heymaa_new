/** Client-side memory/milestone detection (mirrors backend/memory_suggestions.py). */

import type { AppMemory } from './memoryTypes';

export type MemorySuggestionKind = 'milestone' | 'moment';

export interface MemorySuggestion {
  text: string;
  emoji: string;
  description?: string | null;
  ref?: string | null;
  kind?: MemorySuggestionKind;
  dateIso?: string;
  added?: boolean;
  dismissed?: boolean;
}

const SKIP = /^(\s*(τι|what|how|why|when|where|ποιος|ποια|ποιο|πώς|γιατί|πότε|που)\b|.*\?(.*\?)?$|(should i|τι να κάνω|help me|βοήθ|μπορείς|can you|tell me|πες μου|explain))/i;

const MILESTONE =
  /(πρώτ|πρωτ|1ο\s|1η\s|first\s+(time|steps?|word|tooth|smile|bath|haircut)|πρώτα\s+(βήματα|δοντάκ|χαμόγελ|λέξη|μπιμπίκο|κούρεμα)|πρωτα\s+(βηματα|δοντακ|χαμογελ|λεξη|μπικινι|κουρεμα))/i;

const MOMENT =
  /(σήμερα|σημερα|χθες|εχθές|εχες|today|yesterday).{0,50}(έκανε|εκανε|έκαν|εκαν|περπάτη|περπατη|walk|smil|κοιμ|slept|είπε|ειπε|said|έφαγε|εφαγε|ate|έπεσε|επεσε|fell|μπήκε|μπηκε|climb)/i;

const EMOTIONAL = /(🎉|💛|❤️|τόσο\s+όμορφ|so\s+(cute|proud|happy)|μπράβο|proud)/i;

const EMOJI_MAP: [RegExp, string][] = [
  [/(δοντ|tooth|teeth)/i, '🦷'],
  [/(χαμογ|smil)/i, '😊'],
  [/(βήμα|walk|step|περπα)/i, '🚶'],
  [/(μπάνι|bath)/i, '🛁'],
  [/(κοιμ|sleep)/i, '😴'],
  [/(μίλ|word|speak|said|είπε|babbl)/i, '👶'],
];

function normalize(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function emojiFor(text: string): string {
  for (const [pat, em] of EMOJI_MAP) {
    if (pat.test(text)) return em;
  }
  return '💛';
}

function isDuplicate(text: string, recent: Pick<AppMemory, 'text'>[]): boolean {
  const norm = normalize(text).slice(0, 100);
  if (!norm) return true;
  for (const m of recent) {
    const existing = normalize(m.text || '').slice(0, 100);
    if (!existing) continue;
    if (norm.includes(existing) || existing.includes(norm)) return true;
    const a = new Set(norm.split(' '));
    const b = new Set(existing.split(' '));
    const overlap = Array.from(a).filter((w) => b.has(w)).length;
    if (overlap >= Math.max(3, Math.min(a.size, b.size) / 2)) return true;
  }
  return false;
}

function extractTitle(message: string, lang: string): string {
  const text = message.trim();
  const parts = text.split(/[.!?\n]+/);
  let title = (parts[0] || text).trim();
  title = title
    .replace(/^(σήμερα|χθες|εχθές|today|yesterday|το\s+μωρό|το\s+παιδί|my\s+baby|the\s+baby)\s*[,:-]?\s*/i, '')
    .trim();
  if (title.length > 88) title = `${title.slice(0, 85).trim()}…`;
  if (title.length < 8) title = text.slice(0, 88);
  if (lang === 'el' && title) {
    return title.length > 1 ? title[0].toUpperCase() + title.slice(1) : title.toUpperCase();
  }
  return title ? title[0].toUpperCase() + title.slice(1) : text.slice(0, 88);
}

function inferRef(
  message: string,
  profile: {
    childName?: string;
    dueDate?: string | null;
    children?: { name: string }[];
  },
): string | undefined {
  const msgLower = message.toLowerCase();
  for (const ch of profile.children || []) {
    if (ch.name && msgLower.includes(ch.name.toLowerCase())) return ch.name;
  }
  if (
    profile.dueDate &&
    /(εγκυμοσύν|pregnanc|έμβρυ|κοιλ|bump|ultrasound|υπέρηχ)/i.test(message)
  ) {
    return 'pregnancy';
  }
  const first = profile.children?.[0]?.name;
  if (first) return first;
  return profile.childName || undefined;
}

export function detectMemorySuggestion(
  message: string,
  options: {
    profile?: {
      childName?: string;
      dueDate?: string | null;
      children?: { name: string }[];
    };
    recentMemories?: Pick<AppMemory, 'text'>[];
    lang?: string;
  } = {},
): MemorySuggestion | null {
  const text = (message || '').trim();
  if (text.length < 14 || text.length > 600) return null;
  if (SKIP.test(text)) return null;

  let kind: MemorySuggestionKind | null = null;
  if (MILESTONE.test(text)) kind = 'milestone';
  else if (MOMENT.test(text)) kind = 'moment';
  else if (text.length >= 28 && EMOTIONAL.test(text)) kind = 'moment';

  if (!kind) return null;

  const lang = options.lang || 'el';
  const title = extractTitle(text, lang);
  const recent = options.recentMemories || [];
  if (isDuplicate(title, recent) || isDuplicate(text, recent)) return null;

  const ref = inferRef(text, options.profile || {});
  const description = normalize(text) !== normalize(title) ? text : null;

  return {
    text: title,
    emoji: emojiFor(text),
    description: description ? description.slice(0, 240) : null,
    ref: ref ?? null,
    kind,
    dateIso: new Date().toISOString().slice(0, 10),
  };
}

function wordOverlapScore(a: string, b: string): number {
  const setA = new Set(normalize(a).split(' ').filter(Boolean));
  const setB = new Set(normalize(b).split(' ').filter(Boolean));
  if (!setA.size || !setB.size) return 0;
  const overlap = Array.from(setA).filter((w) => setB.has(w)).length;
  return overlap / Math.max(setA.size, setB.size);
}

/** Fuzzy-match chat text to a milestone checklist label index. */
export function findMatchingMilestoneIndex(text: string, labels: string[]): number | null {
  let bestIdx: number | null = null;
  let bestScore = 0;
  labels.forEach((label, idx) => {
    const score = wordOverlapScore(text, label);
    if (score > bestScore && score >= 0.35) {
      bestScore = score;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

export function mapApiMemorySuggestion(raw: Record<string, unknown> | null | undefined): MemorySuggestion | null {
  if (!raw || typeof raw.text !== 'string' || !raw.text.trim()) return null;
  return {
    text: String(raw.text),
    emoji: typeof raw.emoji === 'string' ? raw.emoji : '💛',
    description: typeof raw.description === 'string' ? raw.description : null,
    ref: typeof raw.ref === 'string' ? raw.ref : null,
    kind: raw.kind === 'milestone' || raw.kind === 'moment' ? raw.kind : undefined,
    dateIso: typeof raw.date_iso === 'string' ? raw.date_iso : new Date().toISOString().slice(0, 10),
  };
}
