/** Controls whether analytics events may be pushed (stopped immediately on revoke). */
let dispatchEnabled = false

export function setDispatchEnabled(on: boolean): void {
  dispatchEnabled = on
}

export function isDispatchEnabled(): boolean {
  return dispatchEnabled
}

export function ensureDataLayerPushReady(): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
}
