import { useEffect } from 'react'

const AUTH_VIEWPORT =
  'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
const DEFAULT_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover'

/**
 * Keep iOS Safari from zooming/panning the login form when the keyboard or
 * password manager opens (inputs under 16px otherwise auto-zoom).
 */
export function useStableMobileViewport() {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const meta = document.querySelector('meta[name="viewport"]')
    const previous = meta?.getAttribute('content') || DEFAULT_VIEWPORT

    html.classList.add('hm-auth-lock')
    body.classList.add('hm-auth-lock')
    meta?.setAttribute('content', AUTH_VIEWPORT)

    const snapX = () => {
      if (window.scrollX) window.scrollTo(0, window.scrollY)
    }
    const vv = window.visualViewport
    window.addEventListener('scroll', snapX, { passive: true })
    vv?.addEventListener('scroll', snapX)
    vv?.addEventListener('resize', snapX)

    return () => {
      html.classList.remove('hm-auth-lock')
      body.classList.remove('hm-auth-lock')
      meta?.setAttribute('content', previous)
      window.removeEventListener('scroll', snapX)
      vv?.removeEventListener('scroll', snapX)
      vv?.removeEventListener('resize', snapX)
    }
  }, [])
}
