/** Capture first-touch UTMs / referrer for signup attribution (Pulse + Insights). */

const STORAGE_KEY = 'hm_acquisition_v1'

export type AcquisitionPayload = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  gclid?: string
  fbclid?: string
  landing_path?: string
  referrer?: string
  captured_at?: string
}

function clean(v: string | null | undefined, max = 120): string {
  return String(v || '')
    .trim()
    .slice(0, max)
}

function referrerOriginPath(raw: string): string {
  try {
    const u = new URL(raw)
    return `${u.origin}${u.pathname}`.slice(0, 200)
  } catch {
    return clean(raw, 200)
  }
}

/** Read + persist first-touch acquisition from the current URL (call once on app boot). */
export function captureAcquisitionFromUrl(search?: string, referrer?: string): AcquisitionPayload {
  let existing: AcquisitionPayload = {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY)
    if (raw) existing = JSON.parse(raw) as AcquisitionPayload
  } catch {
    /* ignore */
  }

  const params = new URLSearchParams(search ?? (typeof window !== 'undefined' ? window.location.search : ''))
  const next: AcquisitionPayload = { ...existing }
  const map: Array<[keyof AcquisitionPayload, string]> = [
    ['utm_source', 'utm_source'],
    ['utm_medium', 'utm_medium'],
    ['utm_campaign', 'utm_campaign'],
    ['utm_content', 'utm_content'],
    ['utm_term', 'utm_term'],
    ['gclid', 'gclid'],
    ['fbclid', 'fbclid'],
  ]
  let touched = false
  for (const [field, key] of map) {
    const val = clean(params.get(key))
    if (val && !next[field]) {
      next[field] = val
      touched = true
    }
  }
  if (!next.landing_path && typeof window !== 'undefined') {
    next.landing_path = clean(`${window.location.pathname}${window.location.search}`, 200)
    touched = true
  }
  const ref = referrer ?? (typeof document !== 'undefined' ? document.referrer : '')
  if (ref && !next.referrer) {
    next.referrer = referrerOriginPath(ref)
    touched = true
  }
  if (touched || !next.captured_at) {
    next.captured_at = next.captured_at || new Date().toISOString()
    try {
      const payload = JSON.stringify(next)
      sessionStorage.setItem(STORAGE_KEY, payload)
      localStorage.setItem(STORAGE_KEY, payload)
    } catch {
      /* ignore */
    }
  }
  return next
}

export function readAcquisition(): AcquisitionPayload | undefined {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as AcquisitionPayload
    if (!parsed || typeof parsed !== 'object') return undefined
    // Drop empty object
    if (!Object.values(parsed).some((v) => v)) return undefined
    return parsed
  } catch {
    return undefined
  }
}

/** Infer channel label for analytics events. */
export function acquisitionChannel(a?: AcquisitionPayload | null): string {
  if (!a) return 'direct'
  if (a.fbclid || (a.utm_source || '').toLowerCase().includes('meta') || (a.utm_source || '').toLowerCase().includes('facebook')) {
    return 'meta'
  }
  if ((a.utm_source || '').toLowerCase() === 'sms' || (a.utm_medium || '').toLowerCase() === 'sms') {
    return 'sms'
  }
  if ((a.utm_source || '').toLowerCase().includes('moosend') || (a.utm_medium || '').toLowerCase() === 'email') {
    return 'email'
  }
  if (a.gclid || (a.utm_medium || '').toLowerCase().includes('cpc')) return 'google_ads'
  if (a.utm_source) return clean(a.utm_source, 40)
  if (a.referrer) return 'referral'
  return 'direct'
}
