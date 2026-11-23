/**
 * Durable soft-prompt snooze helpers.
 * "Later" should survive new sessions (common practice), not reset on every login.
 */

export const PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export function writeSnoozeUntil(key: string, ms: number = PROMPT_SNOOZE_MS): void {
  try {
    localStorage.setItem(key, String(Date.now() + ms));
  } catch {
    /* ignore */
  }
}

export function isSnoozeActive(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    // Legacy session-style flag written as "1"
    if (raw === "1") {
      localStorage.removeItem(key);
      return false;
    }
    const until = Number(raw);
    if (!Number.isFinite(until)) {
      localStorage.removeItem(key);
      return false;
    }
    if (Date.now() < until) return true;
    localStorage.removeItem(key);
    return false;
  } catch {
    return false;
  }
}

export function clearSnooze(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
