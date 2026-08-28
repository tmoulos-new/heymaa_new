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

export const MEMORY_EMOJI_OPTIONS = ['⭐', '🦷', '😊', '👶', '🚶', '🎉', '📷', '❤️', '🍼', '🛁'] as const;

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
