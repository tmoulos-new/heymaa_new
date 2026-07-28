import { useEffect } from 'react'
import { AUTH_LOGO_SRC } from '../auth/authLogo'

/** Keep the browser tab icon in sync with the landing circular brand mark. */
export function BrandFavicon() {
  useEffect(() => {
    const rels = ['icon', 'shortcut icon', 'apple-touch-icon'] as const
    for (const rel of rels) {
      let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
      if (!link) {
        link = document.createElement('link')
        link.rel = rel
        document.head.appendChild(link)
      }
      link.type = 'image/png'
      link.href = AUTH_LOGO_SRC
    }
  }, [])

  return null
}
