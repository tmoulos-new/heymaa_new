/** Defaults — live values from GET /gamification/rules (admin /admin/points). */
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

/** Keep in sync with backend CHAT_DAILY_POINTS_CAP fallback */
export const CHAT_DAILY_POINTS_CAP = 30;

export const REFERRAL_BONUS_POINTS = 40;

export type LivePointAction = {
  el: string
  en: string
  points: number
  path: string
}

export type LiveLevelReward = {
  level_id: number
  plan_slot: 'starter' | 'premium'
  days: number
}

type LivePointRules = {
  actions: LivePointAction[]
  lookup: Record<string, number>
  chat_daily_points_cap: number
  referral_bonus_points: number
  level_rewards: LiveLevelReward[]
}

let liveRules: LivePointRules | null = null

const DEFAULT_LEVEL_REWARDS: LiveLevelReward[] = [
  { level_id: 2, plan_slot: 'starter', days: 3 },
  { level_id: 3, plan_slot: 'starter', days: 7 },
  { level_id: 4, plan_slot: 'premium', days: 3 },
  { level_id: 5, plan_slot: 'premium', days: 7 },
]

function parseLiveLevelRewards(raw: unknown): LiveLevelReward[] | null {
  if (!Array.isArray(raw)) return null
  const out: LiveLevelReward[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const item = row as { level_id?: unknown; plan_slot?: unknown; days?: unknown }
    const levelId = Number(item.level_id)
    const slot = String(item.plan_slot || '').trim().toLowerCase()
    const days = Number(item.days)
    if (!Number.isInteger(levelId) || levelId < 1) continue
    if (slot !== 'starter' && slot !== 'premium') continue
    if (!Number.isFinite(days) || days < 1) continue
    out.push({ level_id: levelId, plan_slot: slot, days })
  }
  return out
}

function defaultLookup(): Record<string, number> {
  const lookup: Record<string, number> = {
    [GAMIFICATION_CHAT_VIDEO_PATH]: GAMIFICATION_POINT_RULES.find((r) => r.path === '/app/memories/add-video')?.points ?? 8,
    '/app/milestones/uncheck': -(GAMIFICATION_POINT_RULES.find((r) => r.path === '/app/milestones/check')?.points ?? 15),
    '/auth/register': REFERRAL_BONUS_POINTS,
  }
  for (const row of GAMIFICATION_POINT_RULES) lookup[row.path] = row.points
  return lookup
}

export function setLivePointRules(payload: Partial<LivePointRules> | null | undefined) {
  if (!payload) return
  const actions = Array.isArray(payload.actions) && payload.actions.length
    ? payload.actions
        .filter((a) => a && typeof a === 'object')
        .map((a) => ({
          el: String(a.el || ''),
          en: String(a.en || ''),
          points: Number(a.points) || 0,
          path: String(a.path || ''),
        }))
    : (liveRules?.actions ?? GAMIFICATION_POINT_RULES.map((r) => ({ ...r })))
  const lookup = {
    ...defaultLookup(),
    ...(liveRules?.lookup || {}),
    ...(payload.lookup && typeof payload.lookup === 'object' ? payload.lookup : {}),
  }
  for (const row of actions) {
    if (row.path) lookup[row.path] = row.points
  }
  const cap = Number(payload.chat_daily_points_cap)
  const referral = Number(payload.referral_bonus_points)
  const parsedRewards = parseLiveLevelRewards(payload.level_rewards)
  liveRules = {
    actions,
    lookup,
    chat_daily_points_cap: Number.isFinite(cap) ? cap : (liveRules?.chat_daily_points_cap ?? CHAT_DAILY_POINTS_CAP),
    referral_bonus_points: Number.isFinite(referral) ? referral : (liveRules?.referral_bonus_points ?? REFERRAL_BONUS_POINTS),
    level_rewards: parsedRewards ?? liveRules?.level_rewards ?? DEFAULT_LEVEL_REWARDS.map((r) => ({ ...r })),
  }
}

export function getLevelPlanRewards(): LiveLevelReward[] {
  return (liveRules?.level_rewards ?? DEFAULT_LEVEL_REWARDS).map((r) => ({ ...r }))
}

export function getPointActions(): LivePointAction[] {
  return liveRules?.actions ?? GAMIFICATION_POINT_RULES.map((r) => ({ ...r }))
}

/** @deprecated use getPointActions() — snapshot of defaults for older imports */
export const POINT_ACTIONS = GAMIFICATION_POINT_RULES.map(({ el, en, points }) => ({
  el,
  en,
  points,
}));

export function getChatDailyPointsCap(): number {
  return liveRules?.chat_daily_points_cap ?? CHAT_DAILY_POINTS_CAP
}

export function getReferralBonusPoints(): number {
  return liveRules?.referral_bonus_points ?? REFERRAL_BONUS_POINTS
}

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

function giftCopy(slot: string, days: number): { el: string; en: string } {
  const plan =
    slot === 'admin'
      ? 'Admin'
      : slot === 'annual'
        ? { el: 'Ετήσιο', en: 'Annual' }
        : slot === 'premium'
          ? 'Premium'
          : slot === 'starter'
            ? 'Starter'
            : slot.charAt(0).toUpperCase() + slot.slice(1)
  const planEl = typeof plan === 'string' ? plan : plan.el
  const planEn = typeof plan === 'string' ? plan : plan.en
  return {
    el: `${days} μέρες δωρεάν πλάνο ${planEl}`,
    en: `${days} days free ${planEn} plan`,
  }
}

export function levelEmoji(levelNumber: number): string {
  return LEVEL_EMOJI[levelNumber] ?? '🌱';
}

export function levelRewardsText(levelNumber: number, lang: string): string {
  const live = getLevelPlanRewards()
  const match = live.find((r) => r.level_id === levelNumber)
  if (match) {
    const copy = giftCopy(match.plan_slot, match.days)
    return lang === 'el' ? copy.el : copy.en
  }
  if (liveRules?.level_rewards) {
    return lang === 'el' ? 'Χωρίς δώρο' : 'No gift'
  }
  const row = LEVEL_REWARDS[levelNumber] ?? LEVEL_REWARDS[1];
  return lang === 'el' ? row.el : row.en;
}

export function gamificationPointsForPath(path: string): number {
  const normalized = path.trim();
  const lookup = liveRules?.lookup
  if (lookup && normalized in lookup) return Number(lookup[normalized]) || 0
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
  const milestonePts = getPointActions().find((r) => r.path === '/app/milestones/check')?.points
    ?? GAMIFICATION_POINT_RULES.find((r) => r.path === '/app/milestones/check')?.points ?? 15;
  const videoPts = getPointActions().find((r) => r.path === '/app/memories/add-video')?.points
    ?? GAMIFICATION_POINT_RULES.find((r) => r.path === '/app/memories/add-video')?.points ?? 8;
  const chatCap = getChatDailyPointsCap()
  const referralPts = getReferralBonusPoints()
  return [
    {
      question: isEl ? 'Πώς κερδίζω πόντους;' : 'How do I earn points?',
      group: isEl ? 'Πόντοι & επίπεδα' : 'Points & levels',
      answer: isEl
        ? 'Κερδίζεις πόντους αυτόματα όταν χρησιμοποιείς την εφαρμογή — χωρίς ξεχωριστή ενέργεια.'
        : 'You earn points automatically when you use the app — no extra steps needed.',
      sections: [
        {
          title: isEl ? 'Πόντοι ανά ενέργεια' : 'Points per action',
          bullets: getPointActions().map((a) =>
            isEl ? `${a.el}: +${a.points} πόντοι` : `${a.en}: +${a.points} points`,
          ),
        },
        {
          title: isEl ? 'Όρια & εξαιρέσεις' : 'Limits & exceptions',
          bullets: isEl
            ? [
                `Ορόσημο: +${milestonePts} μία φορά ανά ορόσημο· αν ξετικάρεις, αφαιρούνται`,
                `Βίντεο (+${videoPts}): σε Αναμνήσεις ή Chat`,
                `Chat: έως ${chatCap} πόντοι/ημέρα από μηνύματα`,
                `Πρόσκληση φίλης: +${referralPts} όταν εγγραφεί με τον κωδικό σου (Προφίλ)`,
              ]
            : [
                `Milestone: +${milestonePts} once per milestone; unticking removes points`,
                `Video (+${videoPts}): in Memories or Chat`,
                `Chat: up to ${chatCap} points/day from messages`,
                `Friend referral: +${referralPts} when they sign up with your code (Profile)`,
              ],
        },
      ],
    },
    {
      question: isEl ? 'Τι είναι τα επίπεδα;' : 'What are levels?',
      group: isEl ? 'Πόντοι & επίπεδα' : 'Points & levels',
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
          bullets: [
            ...GAMIFICATION_LEVELS.map((lv) => {
              const gift = levelRewardsText(lv.number, isEl ? 'el' : 'en')
              return isEl
                ? `Επίπεδο ${lv.number} — ${lv.name_el}: ${gift}`
                : `Level ${lv.number} — ${lv.name_en}: ${gift}`
            }),
            ...(isEl
              ? [
                  'Αν έχεις ήδη Premium/Ετήσιο, δώρο Starter γίνεται ίσες μέρες στο πλάνο σου — χωρίς υποβάθμιση',
                  'Οι μέρες προστίθενται μετά τη λήξη της τρέχουσας πρόσβασης (συνδρομή ή grant)',
                  'Πάτα «Πάρε το δώρο σου!» για να τις ενεργοποιήσεις',
                ]
              : [
                  'If you already have Premium/Annual, a Starter reward becomes the same days on your current plan — no downgrade',
                  'Days are added after your current access ends (subscription or grant)',
                  'Tap «Claim your gift!» to activate them',
                ]),
          ],
        },
      ],
    },
    {
      question: isEl ? 'Πού βλέπω τους πόντους μου;' : 'Where do I see my points?',
      group: isEl ? 'Πόντοι & επίπεδα' : 'Points & levels',
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
  const gamification = buildGamificationFaqItems(lang) as T[]
  const accountGroup = lang === 'el' ? 'Λογαριασμός & ιδιωτικότητα' : 'Account & privacy'
  const insertAt = baseItems.findIndex((item) => item.group === accountGroup)
  if (insertAt < 0) return [...baseItems, ...gamification]
  return [...baseItems.slice(0, insertAt), ...gamification, ...baseItems.slice(insertAt)]
}
