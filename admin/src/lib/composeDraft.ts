/** Cross-tab handoff: Gifts → Emails / Notifications composers. */

export const COMPOSE_DRAFT_KEY = 'hm_admin_compose_draft'

export type ComposeDraft = {
  channel: 'email' | 'notification'
  subject?: string
  title?: string
  body: string
  url: string
  buttonLabel?: string
  includeButton?: boolean
  source?: string
}

export function stashComposeDraft(draft: ComposeDraft): void {
  try {
    sessionStorage.setItem(COMPOSE_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* ignore quota / private mode */
  }
}

export function consumeComposeDraft(channel: ComposeDraft['channel']): ComposeDraft | null {
  try {
    const raw = sessionStorage.getItem(COMPOSE_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ComposeDraft
    if (!parsed || parsed.channel !== channel) return null
    sessionStorage.removeItem(COMPOSE_DRAFT_KEY)
    return parsed
  } catch {
    return null
  }
}

export function giftEmailDraft(row: {
  code: string
  label?: string | null
  gift_type?: string
  plan_slot?: string | null
  days?: number | null
  points?: number | null
}): ComposeDraft {
  const reward = giftRewardLine(row)
  const title = (row.label || '').trim() || 'HeyMaa gift'
  const url = `/app/auth?gift=${encodeURIComponent(row.code)}`
  return {
    channel: 'email',
    subject: `Your HeyMaa gift: ${reward}`.slice(0, 90),
    body: [
      'Hi {name},',
      '',
      `You have a gift waiting: **${title}**.`,
      '',
      `**${reward}**`,
      '',
      'Open HeyMaa and claim it with one tap. If you are signed out, sign in first — the gift stays attached to your link.',
    ].join('\n'),
    url,
    buttonLabel: 'Claim your gift',
    includeButton: true,
    source: `gift:${row.code}`,
  }
}

export function giftNotificationDraft(row: {
  code: string
  label?: string | null
  gift_type?: string
  plan_slot?: string | null
  days?: number | null
  points?: number | null
}): ComposeDraft {
  const reward = giftRewardLine(row)
  const title = (row.label || '').trim() || 'You have a gift'
  return {
    channel: 'notification',
    title: title.slice(0, 120),
    body: `${reward}. Tap to claim in HeyMaa.`.slice(0, 500),
    url: `/app?gift=${encodeURIComponent(row.code)}`,
    source: `gift:${row.code}`,
  }
}

function giftRewardLine(row: {
  gift_type?: string
  plan_slot?: string | null
  days?: number | null
  points?: number | null
}): string {
  const parts: string[] = []
  if (row.gift_type === 'free_plan_days' || row.gift_type === 'combo') {
    parts.push(`${row.days || 0} days ${(row.plan_slot || '').trim() || 'plan'}`)
  }
  if (row.gift_type === 'bonus_points' || row.gift_type === 'combo') {
    parts.push(`+${row.points || 0} pts`)
  }
  return parts.join(' · ') || 'HeyMaa gift'
}

/** Active, not expired, and under max_claims — safe to put in email/notification CTAs. */
export function giftCodeIsOfferable(row: {
  status?: string | null
  expires_at?: string | null
  max_claims?: number | null
  claim_count?: number | null
}): boolean {
  if ((row.status || 'active') !== 'active') return false
  if (row.expires_at) {
    const ends = new Date(row.expires_at).getTime()
    if (!Number.isNaN(ends) && ends <= Date.now()) return false
  }
  const max = row.max_claims
  if (max != null && Number(max) > 0 && Number(row.claim_count || 0) >= Number(max)) return false
  return true
}
