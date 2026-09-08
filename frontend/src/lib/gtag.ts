const GA_MEASUREMENT_ID = 'G-JDCYL7LLHS'
const SCRIPT_ID = 'hm-gtag-js'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function initGoogleAnalytics() {
  if (typeof window === 'undefined') return
  if (document.getElementById(SCRIPT_ID)) return

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // Official snippet queues the Arguments object, not a rest array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false })

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)
}

export function trackPageView(path: string) {
  if (typeof window.gtag !== 'function') return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}
