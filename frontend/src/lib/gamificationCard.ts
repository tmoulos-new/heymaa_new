/** Defaults — live values from GET /gamification/rules (admin /admin/points). */
import type { HomeFaqItem } from '../i18n/homeTypes'
import { pickL } from './appLang'

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
  { number: 1, min_points: 0, name_el: 'Νέα Μαμά', name_en: 'New Mom', name_ro: 'Mamă nouă' },
  { number: 2, min_points: 400, name_el: 'Ενεργή Μαμά', name_en: 'Active Mom', name_ro: 'Mamă activă' },
  { number: 3, min_points: 1000, name_el: 'Αφοσιωμένη Μαμά', name_en: 'Dedicated Mom', name_ro: 'Mamă dedicată' },
  { number: 4, min_points: 2000, name_el: 'Super Μαμά', name_en: 'Super Mom', name_ro: 'Super mamă' },
  { number: 5, min_points: 3500, name_el: 'HeyMaa Champion', name_en: 'HeyMaa Champion', name_ro: 'HeyMaa Champion' },
] as const;

export type GamificationFaqItem = HomeFaqItem
export const LEVEL_EMOJI: Record<number, string> = {
  1: '🌱',
  2: '🌿',
  3: '🌸',
  4: '⭐',
  5: '🏆',
};

export const LEVEL_REWARDS: Record<number, { el: string; en: string; ro: string }> = {
  1: {
    el: 'Νέα Μαμά — ξεκινάς το ταξίδι σου',
    en: 'New Mom — starting your journey',
    ro: 'Mamă nouă — începi călătoria',
  },
  2: { el: '3 μέρες δωρεάν Starter', en: '3 days free Starter', ro: '3 zile Starter gratuit' },
  3: { el: '7 μέρες δωρεάν Starter', en: '7 days free Starter', ro: '7 zile Starter gratuit' },
  4: { el: '3 μέρες δωρεάν Premium', en: '3 days free Premium', ro: '3 zile Premium gratuit' },
  5: { el: '7 μέρες δωρεάν Premium', en: '7 days free Premium', ro: '7 zile Premium gratuit' },
};

function giftCopy(slot: string, days: number): { el: string; en: string; ro: string } {
  const plan =
    slot === 'admin'
      ? 'Admin'
      : slot === 'annual'
        ? { el: 'Ετήσιο', en: 'Annual', ro: 'Anual' }
        : slot === 'premium'
          ? 'Premium'
          : slot === 'starter'
            ? 'Starter'
            : slot.charAt(0).toUpperCase() + slot.slice(1)
  const planEl = typeof plan === 'string' ? plan : plan.el
  const planEn = typeof plan === 'string' ? plan : plan.en
  const planRo = typeof plan === 'string' ? plan : plan.ro
  return {
    el: `${days} μέρες δωρεάν πλάνο ${planEl}`,
    en: `${days} days free ${planEn} plan`,
    ro: `${days} zile plan ${planRo} gratuit`,
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
    return pickL(lang, copy.el, copy.en, copy.ro)
  }
  if (liveRules?.level_rewards) {
    return pickL(lang, 'Χωρίς δώρο', 'No gift', 'Fără cadou')
  }
  const row = LEVEL_REWARDS[levelNumber] ?? LEVEL_REWARDS[1];
  return pickL(lang, row.el, row.en, row.ro);
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
  if (normalized.includes('/milestones/')) return pickL(lang, 'Ορόσημο', 'Milestone', 'Moment');
  if (normalized.includes('/memories/')) return pickL(lang, 'Αναμνήση', 'Memory', 'Amintire');
  if (normalized.includes('/chat/')) return 'Chat';
  return '';
}

/** FAQ entries generated from live rules — appended to home/help FAQ lists */
export function buildGamificationFaqItems(lang: string): GamificationFaqItem[] {
  const milestonePts = getPointActions().find((r) => r.path === '/app/milestones/check')?.points
    ?? GAMIFICATION_POINT_RULES.find((r) => r.path === '/app/milestones/check')?.points ?? 15;
  const videoPts = getPointActions().find((r) => r.path === '/app/memories/add-video')?.points
    ?? GAMIFICATION_POINT_RULES.find((r) => r.path === '/app/memories/add-video')?.points ?? 8;
  const chatCap = getChatDailyPointsCap()
  const referralPts = getReferralBonusPoints()
  const group = pickL(lang, 'Πόντοι & επίπεδα', 'Points & levels', 'Puncte & niveluri')
  return [
    {
      question: pickL(lang, 'Πώς κερδίζω πόντους;', 'How do I earn points?', 'Cum câștig puncte?'),
      group,
      answer: pickL(
        lang,
        'Κερδίζεις πόντους αυτόματα όταν χρησιμοποιείς την εφαρμογή — χωρίς ξεχωριστή ενέργεια.',
        'You earn points automatically when you use the app — no extra steps needed.',
        'Câștigi puncte automat când folosești aplicația — fără pași în plus.',
      ),
      sections: [
        {
          title: pickL(lang, 'Πόντοι ανά ενέργεια', 'Points per action', 'Puncte pe acțiune'),
          bullets: getPointActions().map((a) =>
            pickL(
              lang,
              `${a.el}: +${a.points} πόντοι`,
              `${a.en}: +${a.points} points`,
              `${a.en}: +${a.points} puncte`,
            ),
          ),
        },
        {
          title: pickL(lang, 'Όρια & εξαιρέσεις', 'Limits & exceptions', 'Limite & excepții'),
          bullets: [
            pickL(
              lang,
              `Ορόσημο: +${milestonePts} μία φορά ανά ορόσημο· αν ξετικάρεις, αφαιρούνται`,
              `Milestone: +${milestonePts} once per milestone; unticking removes points`,
              `Moment: +${milestonePts} o dată per moment; dacă debifezi, se scad`,
            ),
            pickL(
              lang,
              `Βίντεο (+${videoPts}): σε Αναμνήσεις ή Chat`,
              `Video (+${videoPts}): in Memories or Chat`,
              `Video (+${videoPts}): în Amintiri sau Chat`,
            ),
            pickL(
              lang,
              `Chat: έως ${chatCap} πόντοι/ημέρα από μηνύματα`,
              `Chat: up to ${chatCap} points/day from messages`,
              `Chat: până la ${chatCap} puncte/zi din mesaje`,
            ),
            pickL(
              lang,
              `Πρόσκληση φίλης: +${referralPts} όταν εγγραφεί με τον κωδικό σου (Προφίλ)`,
              `Friend referral: +${referralPts} when they sign up with your code (Profile)`,
              `Invitație prietenă: +${referralPts} când se înscrie cu codul tău (Profil)`,
            ),
          ],
        },
      ],
    },
    {
      question: pickL(lang, 'Τι είναι τα επίπεδα;', 'What are levels?', 'Ce sunt nivelurile?'),
      group,
      answer: pickL(
        lang,
        'Όσο συγκεντρώνεις πόντους, ανεβαίνεις επίπεδο — από «Νέα Μαμά» έως «HeyMaa Champion».',
        'As you collect points, you level up — from New Mom to HeyMaa Champion.',
        'Pe măsură ce aduni puncte, urci în nivel — de la «Mamă nouă» la «HeyMaa Champion».',
      ),
      sections: [
        {
          title: pickL(lang, 'Επίπεδα & πόντοι', 'Levels & points', 'Niveluri & puncte'),
          bullets: GAMIFICATION_LEVELS.map((lv) =>
            pickL(
              lang,
              `Επίπεδο ${lv.number} — ${lv.name_el}: από ${lv.min_points} πόντους`,
              `Level ${lv.number} — ${lv.name_en}: from ${lv.min_points} points`,
              `Nivel ${lv.number} — ${lv.name_ro}: de la ${lv.min_points} puncte`,
            ),
          ),
        },
        {
          title: pickL(lang, 'Δώρα επιπέδου', 'Level rewards', 'Cadouri pe nivel'),
          bullets: [
            ...GAMIFICATION_LEVELS.map((lv) => {
              const gift = levelRewardsText(lv.number, lang)
              return pickL(
                lang,
                `Επίπεδο ${lv.number} — ${lv.name_el}: ${gift}`,
                `Level ${lv.number} — ${lv.name_en}: ${gift}`,
                `Nivel ${lv.number} — ${lv.name_ro}: ${gift}`,
              )
            }),
            pickL(
              lang,
              'Αν έχεις ήδη Premium/Ετήσιο, δώρο Starter γίνεται ίσες μέρες στο πλάνο σου — χωρίς υποβάθμιση',
              'If you already have Premium/Annual, a Starter reward becomes the same days on your current plan — no downgrade',
              'Dacă ai deja Premium/Anual, un cadou Starter devine aceleași zile pe planul tău — fără downgrade',
            ),
            pickL(
              lang,
              'Οι μέρες προστίθενται μετά τη λήξη της τρέχουσας πρόσβασης (συνδρομή ή grant)',
              'Days are added after your current access ends (subscription or grant)',
              'Zilele se adaugă după ce expiră accesul curent (abonament sau grant)',
            ),
            pickL(
              lang,
              'Πάτα «Πάρε το δώρο σου!» για να τις ενεργοποιήσεις',
              'Tap «Claim your gift!» to activate them',
              'Apasă «Ia cadoul!» ca să le activezi',
            ),
          ],
        },
      ],
    },
    {
      question: pickL(lang, 'Πού βλέπω τους πόντους μου;', 'Where do I see my points?', 'Unde îmi văd punctele?'),
      group,
      answer: pickL(
        lang,
        'Όλα τα στοιχεία gamification βρίσκονται στην καρτέλα Προφίλ.',
        'All gamification info is on the Profile tab.',
        'Toate informațiile de gamification sunt în tab-ul Profil.',
      ),
      sections: [
        {
          title: pickL(lang, 'Τι εμφανίζεται', 'What you see', 'Ce vezi'),
          bullets: [
            pickL(
              lang,
              'Τρέχον επίπεδο και όνομα (π.χ. «Ενεργή Μαμά»)',
              'Current level and name (e.g. Active Mom)',
              'Nivelul curent și numele (ex. «Mamă activă»)',
            ),
            pickL(
              lang,
              'Συνολικοί πόντοι και μπάρα προόδου προς το επόμενο επίπεδο',
              'Total points and progress bar to next level',
              'Puncte totale și bara de progres spre următorul nivel',
            ),
            pickL(
              lang,
              'Λίστα ενεργειών που δίνουν πόντους',
              'List of actions that earn points',
              'Lista acțiunilor care aduc puncte',
            ),
            pickL(
              lang,
              'Κωδικός πρόσκλησης για φίλες',
              'Invite code for friends',
              'Cod de invitație pentru prietene',
            ),
            pickL(
              lang,
              'Εκκρεμές δώρο επιπέδου — αν έχεις ανεβεί επίπεδο',
              'Pending level reward — if you recently leveled up',
              'Cadou de nivel în așteptare — dacă ai urcat recent',
            ),
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
  const accountGroup = pickL(
    lang,
    'Λογαριασμός & ιδιωτικότητα',
    'Account & privacy',
    'Cont & confidențialitate',
  )
  const insertAt = baseItems.findIndex((item) => item.group === accountGroup)
  if (insertAt < 0) return [...baseItems, ...gamification]
  return [...baseItems.slice(0, insertAt), ...gamification, ...baseItems.slice(insertAt)]
}
