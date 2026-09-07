/** Single source of truth — keep in sync with backend POINT_RULES + DEFAULT_LEVELS in main.py */
export const GAMIFICATION_POINT_RULES = [
  { el: 'Σημείωση', en: 'Note', points: 2, path: '/app/memories/add-note' },
  { el: 'Φωτό', en: 'Photo', points: 5, path: '/app/memories/add-photo' },
  { el: 'Chat', en: 'Chat', points: 3, path: '/app/chat/send' },
  { el: 'Βίντεο', en: 'Video', points: 8, path: '/app/memories/add-video' },
  { el: 'Ορόσημο', en: 'Milestone', points: 15, path: '/app/milestones/check' },
] as const;

/** Chat video uses the same points as memory video, different path */
export const GAMIFICATION_CHAT_VIDEO_PATH = '/app/chat/send-video';

/** Keep in sync with backend CHAT_DAILY_POINTS_CAP */
export const CHAT_DAILY_POINTS_CAP = 30;

export const POINT_ACTIONS = GAMIFICATION_POINT_RULES.map(({ el, en, points }) => ({
  el,
  en,
  points,
}));

export const REFERRAL_BONUS_POINTS = 40;

export const GAMIFICATION_LEVELS = [
  { number: 1, min_points: 0, name_el: 'Νέα Μαμά', name_en: 'New Mom' },
  { number: 2, min_points: 400, name_el: 'Ενεργή Μαμά', name_en: 'Active Mom' },
  { number: 3, min_points: 1000, name_el: 'Αφοσιωμένη Μαμά', name_en: 'Dedicated Mom' },
  { number: 4, min_points: 2000, name_el: 'Super Μαμά', name_en: 'Super Mom' },
  { number: 5, min_points: 3500, name_el: 'HeyMaa Champion', name_en: 'HeyMaa Champion' },
] as const;

export type GamificationFaqItem = { question: string; answer: string };
export const LEVEL_EMOJI: Record<number, string> = {
  1: '🌱',
  2: '🌿',
  3: '🌸',
  4: '⭐',
  5: '🏆',
};

export const LEVEL_REWARDS: Record<number, { el: string; en: string }> = {
  1: { el: 'Νέα Μαμά — ξεκινάς το ταξίδι σου', en: 'New Mom — starting your journey' },
  2: { el: '3 μέρες δωρεάν Starter', en: '3 days free Starter' },
  3: { el: '7 μέρες δωρεάν Starter', en: '7 days free Starter' },
  4: { el: '3 μέρες δωρεάν Premium', en: '3 days free Premium' },
  5: { el: '7 μέρες δωρεάν Premium', en: '7 days free Premium' },
};

export function levelEmoji(levelNumber: number): string {
  return LEVEL_EMOJI[levelNumber] ?? '🌱';
}

export function levelRewardsText(levelNumber: number, lang: string): string {
  const row = LEVEL_REWARDS[levelNumber] ?? LEVEL_REWARDS[1];
  return lang === 'el' ? row.el : row.en;
}

export function gamificationPointsForPath(path: string): number {
  const normalized = path.trim();
  if (normalized === GAMIFICATION_CHAT_VIDEO_PATH) {
    return GAMIFICATION_POINT_RULES.find((r) => r.path === '/app/memories/add-video')?.points ?? 8;
  }
  if (normalized === '/app/milestones/uncheck') {
    const checkPts = GAMIFICATION_POINT_RULES.find((r) => r.path === '/app/milestones/check')?.points ?? 15;
    return -checkPts;
  }
  return GAMIFICATION_POINT_RULES.find((r) => r.path === normalized)?.points ?? 0;
}

export function pointsToastSuffix(path: string, lang: string): string {
  const normalized = path.trim();
  if (normalized.includes('/milestones/')) return lang === 'el' ? 'Ορόσημο' : 'Milestone';
  if (normalized.includes('/memories/')) return lang === 'el' ? 'Αναμνήση' : 'Memory';
  if (normalized.includes('/chat/')) return lang === 'el' ? 'Chat' : 'Chat';
  return '';
}

/** FAQ entries generated from live rules — appended to home/help FAQ lists */
export function buildGamificationFaqItems(lang: string): GamificationFaqItem[] {
  const isEl = lang === 'el';
  const milestonePts = GAMIFICATION_POINT_RULES.find((r) => r.path === '/app/milestones/check')?.points ?? 15;
  const videoPts = GAMIFICATION_POINT_RULES.find((r) => r.path === '/app/memories/add-video')?.points ?? 8;
  const pointsLines = POINT_ACTIONS.map((a) =>
    isEl ? `• ${a.el}: +${a.points} πόντοι` : `• ${a.en}: +${a.points} points`,
  ).join('\n');

  return [
    {
      question: isEl ? 'Πώς κερδίζω πόντους;' : 'How do I earn points?',
      answer: isEl
        ? `Κερδίζεις πόντους αυτόματα όταν:\n${pointsLines}\n\nΑν ξετικάρεις ορόσημο, αφαιρούνται οι ${milestonePts} πόντοι (μία φορά ανά ορόσημο).\nΒίντεο (+${videoPts}): σε Αναμνήσεις ή Chat.\nChat: έως ${CHAT_DAILY_POINTS_CAP} πόντοι/ημέρα από μηνύματα.\nΠρόσκληση φίλης: +${REFERRAL_BONUS_POINTS} πόντοι όταν εγγραφεί με τον κωδικό σου (στο Προφίλ).`
        : `You earn points automatically when you:\n${pointsLines}\n\nUnticking a milestone removes the ${milestonePts} points (once per milestone).\nVideo (+${videoPts}): in Memories or Chat.\nChat: up to ${CHAT_DAILY_POINTS_CAP} points/day from messages.\nFriend referral: +${REFERRAL_BONUS_POINTS} points when they sign up with your code (in Profile).`,
    },
    {
      question: isEl ? 'Τι είναι τα επίπεδα;' : 'What are levels?',
      answer: isEl
        ? 'Όσο συγκεντρώνεις πόντους, ανεβαίνεις επίπεδο (από «Νέα Μαμά» έως «HeyMaa Champion»). Στα επίπεδα 2–5 κερδίζεις δωρεάν Starter/Premium — μπορείς να πατήσεις «Πάρε το δώρο σου!» για άμεση ενεργοποίηση (στοιβάζεται με τυχόν ενεργό πλάνο).'
        : 'As you collect points, you level up (New Mom to HeyMaa Champion). Levels 2–5 grant free Starter/Premium days — tap «Claim your gift!» to activate instantly (stacks with any active free plan).',
    },
    {
      question: isEl ? 'Πού βλέπω τους πόντους μου;' : 'Where do I see my points?',
      answer: isEl
        ? 'Μπορείς να ανοίξεις την καρτέλα «Προφίλ». Κάτω από το όνομά σου θα δεις επίπεδο, πόντους, μπάρα προόδου και κωδικό πρόσκλησης.'
        : 'Open the Profile tab. Below your name you will see your level, points, progress bar, and invite code.',
    },
  ];
}

export function mergeGamificationFaqItems<T extends GamificationFaqItem>(
  baseItems: T[],
  lang: string,
): T[] {
  return [...baseItems, ...(buildGamificationFaqItems(lang) as T[])];
}
