/** Shared memory shape for app UI + sync. */

export type MemorySource = 'manual' | 'chat' | 'milestone';

export interface AppMemory {
  emoji: string;
  text: string;
  date: string;
  img?: string;
  video?: string;
  ref?: string;
  createdAt?: string;
  description?: string;
  source?: MemorySource;
  isMilestone?: boolean;
  /** Links to milestones_map entry: `${ref}:${index}` */
  milestoneKey?: string;
}

export const MEMORY_EMOJI_OPTIONS = [
  { emoji: '😊', el: '1ο χαμόγελο', en: 'First smile' },
  { emoji: '🥣', el: '1η στερεά τροφή', en: 'First solid food' },
  { emoji: '🍼', el: '1ο μπιμπερό', en: 'First bottle' },
  { emoji: '🔔', el: '1ο παιχνίδι', en: 'First toy' },
  { emoji: '🚼', el: '1ο μπουσούλημα', en: 'First crawl' },
  { emoji: '🚶', el: '1ο βήμα', en: 'First steps' },
  { emoji: '🦷', el: '1ο δόντι', en: 'First tooth' },
  { emoji: '💬', el: '1η λέξη', en: 'First word' },
  { emoji: '🎉', el: '1ο πάρτυ', en: 'First party' },
  { emoji: '🧱', el: '1ο χτίσιμο πύργου', en: 'First tower' },
  { emoji: '🪜', el: 'Ανέβασμα σκάλας', en: 'Climbing stairs' },
  { emoji: '🌊', el: '1ο μπάνιο στη θάλασσα', en: 'First dip in the sea' },
] as const;

export type MemoryEmojiKey = (typeof MEMORY_EMOJI_OPTIONS)[number]['emoji'];

export function isMemoryMilestone(m: AppMemory): boolean {
  if (m.milestoneKey) return true;
  if (m.source === 'milestone') return true;
  return !!m.isMilestone;
}

export function memorySortTime(m: AppMemory): number {
  if (m.createdAt) {
    const ts = Date.parse(m.createdAt);
    if (!Number.isNaN(ts)) return ts;
  }
  return 0;
}

export function formatMemoryDisplayDate(m: AppMemory, lang: string): string {
  if (m.createdAt) {
    try {
      return new Date(m.createdAt).toLocaleDateString(lang === 'el' ? 'el-GR' : lang, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      /* fall through */
    }
  }
  return m.date;
}
