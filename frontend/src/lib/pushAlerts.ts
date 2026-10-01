/**
 * Web Push helpers: soft opt-in timing, iOS/PWA detection, dismiss cooldown, visit nudges.
 * Browser Notification.requestPermission must only run from a clear user gesture.
 */

const DISMISS_PREFIX = 'hm_push_prompt_dismissed_'
const DISMISS_AT_PREFIX = 'hm_push_prompt_dismissed_at_'
const VISIT_PREFIX = 'hm_push_visit_'
const SOFT_OPT_SESSION = 'hm_signup_push_opt_in'

/** Re-ask soft-opted users after this many days if they dismissed without granting. */
export const PUSH_NUDGE_COOLDOWN_DAYS = 7
/** Show marketing nudge after this many app opens when still on permission default. */
export const PUSH_NUDGE_MIN_VISITS = 3

export function writeSignupPushOptIn(next: boolean) {
  try {
    sessionStorage.setItem(SOFT_OPT_SESSION, next ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function readSignupPushOptIn(): boolean {
  try {
    return sessionStorage.getItem(SOFT_OPT_SESSION) === '1'
  } catch {
    return false
  }
}

export function clearSignupPushOptIn() {
  try {
    sessionStorage.removeItem(SOFT_OPT_SESSION)
  } catch {
    /* ignore */
  }
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** True when running as installed PWA / Home Screen web app. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia?.('(display-mode: standalone)')?.matches
  const iosStandalone = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return Boolean(mq || iosStandalone)
}

function _tokenKey(token: string) {
  return token.slice(0, 24)
}

export function pushPromptDismissed(token: string): boolean {
  if (!token) return true
  try {
    const key = _tokenKey(token)
    const at = localStorage.getItem(DISMISS_AT_PREFIX + key)
    if (at) {
      const ts = Number(at)
      if (Number.isFinite(ts)) {
        const ageMs = Date.now() - ts
        return ageMs < PUSH_NUDGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
      }
    }
    // Legacy forever-dismiss flag — treat as still cooling down once, then convert.
    if (localStorage.getItem(DISMISS_PREFIX + key) === '1') {
      localStorage.setItem(DISMISS_AT_PREFIX + key, String(Date.now()))
      localStorage.removeItem(DISMISS_PREFIX + key)
      return true
    }
    return false
  } catch {
    return false
  }
}

export function dismissPushPrompt(token: string) {
  if (!token) return
  try {
    const key = _tokenKey(token)
    localStorage.setItem(DISMISS_AT_PREFIX + key, String(Date.now()))
    localStorage.removeItem(DISMISS_PREFIX + key)
  } catch {
    /* ignore */
  }
}

/** Count this session open once; returns visit count after increment. */
export function recordPushVisit(token: string): number {
  if (!token) return 0
  try {
    const key = VISIT_PREFIX + _tokenKey(token)
    const sessionFlag = `hm_push_visit_session_${_tokenKey(token)}`
    if (sessionStorage.getItem(sessionFlag) === '1') {
      return Number(localStorage.getItem(key) || '0') || 0
    }
    sessionStorage.setItem(sessionFlag, '1')
    const next = (Number(localStorage.getItem(key) || '0') || 0) + 1
    localStorage.setItem(key, String(next))
    return next
  } catch {
    return 0
  }
}

export function pushVisitCount(token: string): number {
  if (!token) return 0
  try {
    return Number(localStorage.getItem(VISIT_PREFIX + _tokenKey(token)) || '0') || 0
  } catch {
    return 0
  }
}

/** Soft-opted users who have not granted/denied yet should see a deferred in-app ask. */
export function shouldShowDeferredPushPrompt(opts: {
  token: string
  softOptIn: boolean
  permission: NotificationPermission | 'unsupported'
}): boolean {
  if (!opts.token || !opts.softOptIn) return false
  if (opts.permission !== 'default') return false
  if (pushPromptDismissed(opts.token)) return false
  if (isIosDevice() && !isStandaloneDisplay()) {
    // Still show — copy explains Home Screen requirement.
    return true
  }
  return true
}

/**
 * Marketing re-prompt for users who never activated lock-screen alerts.
 * Soft-opted: after tour / cooldown. Others: after enough visits + cooldown.
 */
export function shouldShowMarketingPushNudge(opts: {
  token: string
  softOptIn: boolean
  permission: NotificationPermission | 'unsupported'
  visits?: number
}): boolean {
  if (!opts.token) return false
  if (opts.permission !== 'default') return false
  if (pushPromptDismissed(opts.token)) return false
  if (opts.softOptIn) return true
  const visits = opts.visits ?? pushVisitCount(opts.token)
  return visits >= PUSH_NUDGE_MIN_VISITS
}
