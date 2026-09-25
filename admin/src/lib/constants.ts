export const BADGE_COLORS: Record<string, string> = {
  news: '#4ABEAA',
  promo: '#de5a9e',
  sponsored: '#7C5CBF',
}

export const TAB_TITLES: Record<string, string> = {
  overview: 'Overview',
  insights: 'Insights',
  quality: 'Quality',
  testers: 'Testers',
  invites: 'Invite Codes',
  regions: 'Regions',
  points: 'Points & Levels',
  plans: 'Plans',
  content: 'Offers & Promos',
  sources: 'RAG Sources',
  users: 'Users',
  cancellations: 'Cancellations',
  userdata: 'User Data',
  useractivity: 'User Activity',
  chatprompt: 'Chat Prompt',
  llmtransactions: 'LLM Transactions',
  userfinancials: 'User Financials',
  tools: 'Tools',
  activity: 'Admin Activity',
}

export const TAB_SUBTITLES: Record<string, string> = {
  overview: 'Attention, health, and a quick business snapshot',
  insights: 'Growth, revenue model, spend, and behaviour',
  quality: 'Reply health, thumbs, and fix proposals',
  testers: 'Invite and provision tester accounts',
  invites: 'Manage invite codes and access',
  regions: 'Geo targeting for offers and promos',
  points: 'Gamification rules and level gifts',
  plans: 'Catalog, quotas, and plan copy',
  content: 'Offers and sponsored promotions',
  sources: 'RAG documents and ingest status',
  users: 'Accounts, plans, and support actions',
  cancellations: 'Review and approve cancel requests',
  userdata: 'Inspect stored family, chat, and memories',
  useractivity: 'In-app clicks, views, and navigation',
  chatprompt: 'System prompt + LLM routing (Grok / Gemini / Claude)',
  llmtransactions: 'Per-call LLM cost ledger',
  userfinancials: 'Usage vs plan limits per user',
  tools: 'Seeding and maintenance utilities',
  activity: 'Admin audit trail',
}

export type TabId = keyof typeof TAB_TITLES

/** Sidebar information architecture — groups keep the long nav scannable. */
export const NAV_GROUPS: { label: string; ids: TabId[] }[] = [
  { label: 'Home', ids: ['overview', 'insights', 'quality'] },
  { label: 'People', ids: ['users', 'cancellations', 'testers', 'invites'] },
  { label: 'Product', ids: ['plans', 'points', 'content', 'regions', 'sources'] },
  {
    label: 'Intelligence',
    ids: ['chatprompt', 'llmtransactions', 'userfinancials', 'userdata', 'useractivity'],
  },
  { label: 'System', ids: ['activity', 'tools'] },
]

/** URL segment under /admin (empty string = overview at /admin). */
export const TAB_PATHS: Record<TabId, string> = {
  overview: '',
  insights: 'insights',
  quality: 'quality',
  testers: 'testers',
  invites: 'invite-codes',
  regions: 'regions',
  points: 'points',
  plans: 'plans',
  content: 'content',
  sources: 'sources',
  users: 'users',
  cancellations: 'cancellations',
  userdata: 'user-data',
  useractivity: 'user-activity',
  chatprompt: 'chat-prompt',
  llmtransactions: 'llm-transactions',
  userfinancials: 'user-financials',
  tools: 'tools',
  activity: 'activity-log',
}

const PATH_TO_TAB = Object.fromEntries(
  (Object.entries(TAB_PATHS) as [TabId, string][]).map(([id, path]) => [path || '_root', id]),
) as Record<string, TabId>

export function tabIdFromLocation(pathname: string): TabId {
  const segment = pathname.replace(/^\/+/, '').split('/')[0] || '_root'
  if (segment === 'levels') return 'points'
  return PATH_TO_TAB[segment] ?? 'overview'
}

export function pathForTab(id: TabId): string {
  const segment = TAB_PATHS[id]
  return segment ? `/${segment}` : '/'
}

export const ADMIN_UI_GET_PATHS = new Set(
  ['', ...Object.values(TAB_PATHS).filter(Boolean), 'levels'].map((p) => (p ? `/admin/${p}` : '/admin')),
)

export const TESTER_CODES = Array.from({ length: 30 }, (_, i) =>
  `HeyMaa_Tester${String(i + 1).padStart(2, '0')}`,
)

export const LANG_OPTIONS = [
  { value: 'el', label: '🇬🇷 Ελληνικά' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'ar', label: '🇸🇦 العربية' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'ro', label: '🇷🇴 Română' },
  { value: 'tr', label: '🇹🇷 Türkçe' },
  { value: 'ru', label: '🇷🇺 Русский' },
  { value: 'uk', label: '🇺🇦 Українська' },
  { value: 'pl', label: '🇵🇱 Polski' },
  { value: 'cs', label: '🇨🇿 Čeština' },
  { value: 'sk', label: '🇸🇰 Slovenčina' },
  { value: 'hu', label: '🇭🇺 Magyar' },
  { value: 'bg', label: '🇧🇬 Български' },
  { value: 'hr', label: '🇭🇷 Hrvatski' },
  { value: 'sr', label: '🇷🇸 Srpski' },
  { value: 'sl', label: '🇸🇮 Slovenščina' },
  { value: 'nl', label: '🇳🇱 Nederlands' },
  { value: 'pt', label: '🇵🇹 Português' },
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'he', label: '🇮🇱 עברית' },
  { value: 'hi', label: '🇮🇳 हिन्दी' },
]
