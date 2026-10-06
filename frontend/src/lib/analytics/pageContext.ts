import {
  pageTitleForPath,
  sanitizeAbsoluteUrl,
  sanitizePathname,
  sanitizeReferrer,
} from './sanitize'

export type SafePageContext = {
  page_location: string
  page_path: string
  page_title: string
  page_referrer: string
}

let previousSanitizedUrl = ''
let initialReferrerCaptured = false

function origin(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'https://www.heymaa.ai'
}

/** Capture document.referrer once (sanitized). Later referrers are virtual. */
export function captureInitialReferrer(): string {
  if (initialReferrerCaptured) return previousSanitizedUrl ? '' : ''
  initialReferrerCaptured = true
  const external = sanitizeReferrer(typeof document !== 'undefined' ? document.referrer : '')
  return external
}

export function buildSafePageContext(pathname: string, search = ''): SafePageContext {
  void search // queries never included
  const page_path = sanitizePathname(pathname)
  const page_location = sanitizeAbsoluteUrl(`${origin()}${page_path}`, origin())
  const page_title = pageTitleForPath(page_path)

  let page_referrer = ''
  if (!previousSanitizedUrl) {
    page_referrer = captureInitialReferrer()
  } else {
    page_referrer = previousSanitizedUrl
  }

  return { page_location, page_path, page_title, page_referrer }
}

/** Advance virtual referrer after a page_view was successfully queued. */
export function commitPageViewContext(ctx: SafePageContext): void {
  previousSanitizedUrl = ctx.page_location
}

export function peekPreviousSanitizedUrl(): string {
  return previousSanitizedUrl
}

/** Test helper */
export function resetPageContextForTests(): void {
  previousSanitizedUrl = ''
  initialReferrerCaptured = false
}
