import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE_ORIGIN = 'https://www.heymaa.ai'
const DEFAULT_IMAGE = `${SITE_ORIGIN}/logo512.png`

export type SeoConfig = {
  title: string
  description: string
  /** Path only, no query — used for canonical. */
  canonicalPath: string
  robots?: string
  ogType?: string
}

const PUBLIC: Record<string, SeoConfig> = {
  '/': {
    title: 'HeyMaa — AI companion for pregnancy and motherhood',
    description:
      'HeyMaa helps you organise memories, follow your child\'s development, and get everyday support for pregnancy and motherhood — calmly, in one place.',
    canonicalPath: '/',
    robots: 'index,follow',
  },
  '/privacy': {
    title: 'Privacy & Data Protection Policy — HeyMaa',
    description:
      'How HeyMaa and Care Direct process personal data, cookies, and your privacy rights.',
    canonicalPath: '/privacy',
    robots: 'index,follow',
  },
  '/terms': {
    title: 'Terms & Conditions of Use — HeyMaa',
    description: 'Terms governing use of the HeyMaa application and website.',
    canonicalPath: '/terms',
    robots: 'index,follow',
  },
}

const PRIVATE_PREFIXES = ['/app', '/auth', '/checkout', '/admin', '/subscription']

function normalizePath(pathname: string): string {
  let path = (pathname || '/').split('?')[0].split('#')[0] || '/'
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  if (path === '/checkout/failed') return '/checkout/failure'
  if (path === '/home') return '/'
  return path || '/'
}

function isPrivatePath(path: string): boolean {
  return PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function resolveSeo(pathname: string): SeoConfig {
  const path = normalizePath(pathname)
  if (PUBLIC[path]) return PUBLIC[path]

  if (isPrivatePath(path)) {
    const title =
      path.startsWith('/checkout')
        ? 'Checkout — HeyMaa'
        : path.startsWith('/app/auth') || path === '/auth'
          ? 'Sign in — HeyMaa'
          : path.startsWith('/admin')
            ? 'Admin — HeyMaa'
            : path === '/subscription'
              ? 'Subscription — HeyMaa'
              : 'HeyMaa'
    return {
      title,
      description: 'HeyMaa account and product utilities.',
      canonicalPath: path.startsWith('/app') ? '/app' : path.split('/').slice(0, 2).join('/') || path,
      robots: 'noindex,nofollow',
    }
  }

  // Unknown SPA paths: keep the bad URL, never advertise as the homepage.
  return {
    title: 'Page not found — HeyMaa',
    description: 'This page does not exist on HeyMaa.',
    canonicalPath: path,
    robots: 'noindex,nofollow',
  }
}

/**
 * Route-aware title/description/canonical/OG/robots.
 * Private routes never keep the landing canonical from index.html.
 */
export function SeoHead() {
  const { pathname } = useLocation()

  useEffect(() => {
    const seo = resolveSeo(pathname)
    const canonical = `${SITE_ORIGIN}${seo.canonicalPath === '/' ? '/' : seo.canonicalPath}`

    document.title = seo.title
    upsertMeta('name', 'description', seo.description)
    upsertMeta('name', 'robots', seo.robots || 'index,follow')
    upsertLink('canonical', canonical)

    upsertMeta('property', 'og:type', seo.ogType || 'website')
    upsertMeta('property', 'og:site_name', 'HeyMaa')
    upsertMeta('property', 'og:title', seo.title)
    upsertMeta('property', 'og:description', seo.description)
    upsertMeta('property', 'og:url', canonical)
    upsertMeta('property', 'og:image', DEFAULT_IMAGE)

    upsertMeta('name', 'twitter:card', 'summary')
    upsertMeta('name', 'twitter:title', seo.title)
    upsertMeta('name', 'twitter:description', seo.description)
  }, [pathname])

  return null
}

export function seoConfigForPath(pathname: string): SeoConfig {
  return resolveSeo(pathname)
}
