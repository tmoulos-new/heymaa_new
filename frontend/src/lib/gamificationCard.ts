/** Single source of truth — keep in sync with backend POINT_RULES + DEFAULT_LEVELS in main.py */
import type { HomeFaqItem } from '../i18n/homeTypes'

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

export type GamificationFaqItem = HomeFaqItem
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
  return [
    {
      question: isEl ? 'Πώς κερδίζω πόντους;' : 'How do I earn points?',
      answer: isEl
        ? 'Κερδίζεις πόντους αυτόματα όταν χρησιμοποιείς την εφαρμογή — χωρίς ξεχωριστή ενέργεια.'
        : 'You earn points automatically when you use the app — no extra steps needed.',
      sections: [
        {
          title: isEl ? 'Πόντοι ανά ενέργεια' : 'Points per action',
          bullets: POINT_ACTIONS.map((a) =>
            isEl ? `${a.el}: +${a.points} πόντοι` : `${a.en}: +${a.points} points`,
          ),
        },
        {
          title: isEl ? 'Όρια & εξαιρέσεις' : 'Limits & exceptions',
          bullets: isEl
            ? [
                `Ορόσημο: +${milestonePts} μία φορά ανά ορόσημο· αν ξετικάρεις, αφαιρούνται`,
                `Βίντεο (+${videoPts}): σε Αναμνήσεις ή Chat`,
                `Chat: έως ${CHAT_DAILY_POINTS_CAP} πόντοι/ημέρα από μηνύματα`,
                `Πρόσκληση φίλης: +${REFERRAL_BONUS_POINTS} όταν εγγραφεί με τον κωδικό σου (Προφίλ)`,
              ]
            : [
                `Milestone: +${milestonePts} once per milestone; unticking removes points`,
                `Video (+${videoPts}): in Memories or Chat`,
                `Chat: up to ${CHAT_DAILY_POINTS_CAP} points/day from messages`,
                `Friend referral: +${REFERRAL_BONUS_POINTS} when they sign up with your code (Profile)`,
              ],
        },
      ],
    },
    {
      question: isEl ? 'Τι είναι τα επίπεδα;' : 'What are levels?',
      answer: isEl
        ? 'Όσο συγκεντρώνεις πόντους, ανεβαίνεις επίπεδο — από «Νέα Μαμά» έως «HeyMaa Champion».'
        : 'As you collect points, you level up — from New Mom to HeyMaa Champion.',
      sections: [
        {
          title: isEl ? 'Επίπεδα & πόντοι' : 'Levels & points',
          bullets: GAMIFICATION_LEVELS.map((lv) =>
            isEl
              ? `Επίπεδο ${lv.number} — ${lv.name_el}: από ${lv.min_points} πόντους`
              : `Level ${lv.number} — ${lv.name_en}: from ${lv.min_points} points`,
          ),
        },
        {
          title: isEl ? 'Δώρα επιπέδου' : 'Level rewards',
          bullets: isEl
            ? [
                'Επίπεδα 2–5: δωρεάν ημέρες Starter ή Premium',
                'Αν έχεις ήδη Premium/Ετήσιο, δώρο Starter γίνεται ίσες μέρες στο πλάνο σου — χωρίς υποβάθμιση',
                'Οι μέρες προστίθενται μετά τη λήξη της τρέχουσας πρόσβασης (συνδρομή ή grant)',
                'Πάτα «Πάρε το δώρο σου!» για να τις ενεργοποιήσεις',
              ]
            : [
                'Levels 2–5: free Starter or Premium days',
                'If you already have Premium/Annual, a Starter reward becomes the same days on your current plan — no downgrade',
                'Days are added after your current access ends (subscription or grant)',
                'Tap «Claim your gift!» to activate them',
              ],
        },
      ],
    },
    {
      question: isEl ? 'Πού βλέπω τους πόντους μου;' : 'Where do I see my points?',
      answer: isEl
        ? 'Όλα τα στοιχεία gamification βρίσκονται στην καρτέλα Προφίλ.'
        : 'All gamification info is on the Profile tab.',
      sections: [
        {
          title: isEl ? 'Τι εμφανίζεται' : 'What you see',
          bullets: isEl
            ? [
                'Τρέχον επίπεδο και όνομα (π.χ. «Ενεργή Μαμά»)',
                'Συνολικοί πόντοι και μπάρα προόδου προς το επόμενο επίπεδο',
                'Λίστα ενεργειών που δίνουν πόντους',
                'Κωδικός πρόσκλησης για φίλες',
                'Εκκρεμές δώρο επιπέδου — αν έχεις ανεβεί επίπεδο',
              ]
            : [
                'Current level and name (e.g. Active Mom)',
                'Total points and progress bar to next level',
                'List of actions that earn points',
                'Invite code for friends',
                'Pending level reward — if you recently leveled up',
              ],
        },
      ],
    },
  ];
}

export function mergeGamificationFaqItems<T extends GamificationFaqItem>(
  baseItems: T[],
  lang: string,
): T[] {
  return [...baseItems, ...(buildGamificationFaqItems(lang) as T[])];
}
