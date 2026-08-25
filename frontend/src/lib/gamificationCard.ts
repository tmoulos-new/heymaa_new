/** Single source of truth — keep in sync with backend POINT_RULES + DEFAULT_LEVELS in main.py */
export const GAMIFICATION_POINT_RULES = [  { el: 'Σημείωση', en: 'Note', points: 5, path: '/app/memories/add-note' },
  { el: 'Φωτό', en: 'Photo', points: 10, path: '/app/memories/add-photo' },
  { el: 'Chat', en: 'Chat', points: 15, path: '/app/chat/send' },
  { el: 'Βίντεο', en: 'Video', points: 20, path: '/app/memories/add-video' },
  { el: 'Ορόσημο', en: 'Milestone', points: 50, path: '/app/milestones/check' },
] as const;

/** Chat video uses the same points as memory video, different path */
export const GAMIFICATION_CHAT_VIDEO_PATH = '/app/chat/send-video';

export const POINT_ACTIONS = GAMIFICATION_POINT_RULES.map(({ el, en, points }) => ({
  el,
  en,
  points,
}));

export const REFERRAL_BONUS_POINTS = 50;

export const GAMIFICATION_LEVELS = [
  { number: 1, min_points: 0, name_el: 'Νέα Μαμά', name_en: 'New Mom' },
  { number: 2, min_points: 250, name_el: 'Ενεργή Μαμά', name_en: 'Active Mom' },
  { number: 3, min_points: 750, name_el: 'Αφοσιωμένη Μαμά', name_en: 'Dedicated Mom' },
  { number: 4, min_points: 1500, name_el: 'Super Μαμά', name_en: 'Super Mom' },
  { number: 5, min_points: 2500, name_el: 'HeyMaa Champion', name_en: 'HeyMaa Champion' },
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
  1: { el: 'Βασική πρόσβαση • Chat με AI', en: 'Basic access • AI Chat' },
  2: { el: 'Προτεραιότητα απαντήσεων • Extra prompts', en: 'Priority replies • Extra prompts' },
  3: { el: 'Αποκλειστικές προσφορές • Premium tips', en: 'Exclusive offers • Premium tips' },
  4: { el: 'Early access • VIP υποστήριξη', en: 'Early access • VIP support' },
  5: { el: 'Champion badge • Όλα τα perks', en: 'Champion badge • All perks' },
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
    return GAMIFICATION_POINT_RULES.find((r) => r.path === '/app/memories/add-video')?.points ?? 20;
  }
  return GAMIFICATION_POINT_RULES.find((r) => r.path === normalized)?.points ?? 0;
}

function gamificationLevelLabel(
  level: (typeof GAMIFICATION_LEVELS)[number],
  lang: string,
): string {
  return lang === 'el' ? level.name_el : level.name_en;
}

/** FAQ entries generated from live rules — appended to home/help FAQ lists */
export function buildGamificationFaqItems(lang: string): GamificationFaqItem[] {
  const isEl = lang === 'el';
  const actionsLine = POINT_ACTIONS.map((a) =>
    `${isEl ? a.el : a.en} +${a.points}`,
  ).join(' • ');

  const levelsLine = GAMIFICATION_LEVELS.map((level) => {
    const name = gamificationLevelLabel(level, lang);
    const rewards = levelRewardsText(level.number, lang);
    return isEl
      ? `${name} (από ${level.min_points} πόντους): ${rewards}`
      : `${name} (from ${level.min_points} points): ${rewards}`;
  }).join(' · ');

  return [
    {
      question: isEl ? 'Πώς κερδίζω πόντους;' : 'How do I earn points?',
      answer: isEl
        ? `Κερδίζεις αυτόματα όταν χρησιμοποιείς την εφαρμογή: ${actionsLine}. Το βίντεο (+20) μπορείς να το προσθέσεις σε αναμνήσεις ή chat. Στο «Προφίλ μου» βλέπεις τους πόντους σου και τον κωδικό πρόσκλησης — +${REFERRAL_BONUS_POINTS} πόντοι για κάθε φίλη που εγγράφεται με τον κωδικό σου.`
        : `You earn points automatically as you use the app: ${actionsLine}. Video (+20) can be added in Memories or Chat. In My profile you see your points and invite code — +${REFERRAL_BONUS_POINTS} points for each friend who signs up with your code.`,
    },
    {
      question: isEl ? 'Τι είναι τα επίπεδα (levels);' : 'What are levels?',
      answer: isEl
        ? `Όσο συγκεντρώνεις πόντους, ανεβαίνεις επίπεδο. Τα δώρα κάθε επιπέδου: ${levelsLine}. Η πρόοδός σου εμφανίζεται στην κάρτα gamification στο «Προφίλ μου».`
        : `As you collect points, you level up. Rewards per level: ${levelsLine}. Your progress appears on the gamification card in My profile.`,
    },
    {
      question: isEl ? 'Πού βρίσκω την πρόοδό μου;' : 'Where can I see my progress?',
      answer: isEl
        ? 'Στο tab «Προφίλ» → «Το προφίλ μου», κάτω από την κάρτα με το όνομά σου. Εκεί θα δεις επίπεδο, πόντους, progress bar, δώρα επιπέδου και κωδικό πρόσκλησης.'
        : 'Open the Profile tab → My profile, below your name card. There you will see your level, points, progress bar, level rewards, and invite code.',
    },
  ];
}

export function mergeGamificationFaqItems<T extends GamificationFaqItem>(
  baseItems: T[],
  lang: string,
): T[] {
  return [...baseItems, ...(buildGamificationFaqItems(lang) as T[])];
}