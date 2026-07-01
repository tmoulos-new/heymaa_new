export const BADGE_COLORS: Record<string, string> = {
  news: '#4ABEAA',
  promo: '#E07B54',
  sponsored: '#7C5CBF',
}

export const TAB_TITLES: Record<string, string> = {
  overview: 'Overview',
  testers: 'Testers',
  invites: 'Invite Codes',
  regions: 'Regions',
  content: 'Offers & Promos',
  users: 'Users',
  tools: 'Tools',
}

export type TabId = keyof typeof TAB_TITLES

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
