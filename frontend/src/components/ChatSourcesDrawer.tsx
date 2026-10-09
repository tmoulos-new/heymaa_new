import { useEffect } from 'react'
import { normalizeAppLang, type AppLangCode } from '../lib/appLang'
import { AppModalPortal } from './AppModalPortal'

export type ChatSourceLink = {
  title: string
  url: string
}

const SOURCES_COPY: Record<
  AppLangCode,
  { label: string; title: string; subtitle: string; close: string }
> = {
  en: {
    label: 'Sources',
    title: 'Sources',
    subtitle: 'Pages that backed this answer.',
    close: 'Close',
  },
  el: {
    label: 'Πηγές',
    title: 'Πηγές',
    subtitle: 'Σελίδες που στήριξαν αυτή την απάντηση.',
    close: 'Κλείσιμο',
  },
  ro: {
    label: 'Surse',
    title: 'Surse',
    subtitle: 'Pagini care au susținut acest răspuns.',
    close: 'Închide',
  },
}

export function chatSourcesCopy(lang: string) {
  return SOURCES_COPY[normalizeAppLang(lang, 'en')]
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function parseChatSources(raw: unknown): ChatSourceLink[] | null {
  if (!Array.isArray(raw)) return null
  const out: ChatSourceLink[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const url = String((item as { url?: unknown }).url || '').trim()
    if (!/^https?:\/\//i.test(url)) continue
    const key = url.split('?')[0]
    if (seen.has(key)) continue
    seen.add(key)
    const title = String((item as { title?: unknown }).title || '').trim() || hostOf(url)
    out.push({ title: title.slice(0, 160), url })
    if (out.length >= 4) break
  }
  return out.length ? out : null
}

type Props = {
  lang: string
  sources: ChatSourceLink[] | null
  onClose: () => void
}

export function ChatSourcesDrawer({ lang, sources, onClose }: Props) {
  const open = !!sources && sources.length > 0
  const copy = chatSourcesCopy(lang)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !sources) return null

  return (
    <AppModalPortal>
      <div className="hm-sources-root" role="presentation">
        <button type="button" className="hm-sources-backdrop" aria-label={copy.close} onClick={onClose} />
        <aside className="hm-sources-drawer" role="dialog" aria-modal="true" aria-label={copy.title}>
          <div className="hm-sources-drawer__head">
            <div>
              <h2>{copy.title}</h2>
              <p>{copy.subtitle}</p>
            </div>
            <button type="button" className="hm-sources-drawer__close" onClick={onClose} aria-label={copy.close}>
              ×
            </button>
          </div>
          <ul className="hm-sources-list">
            {sources.map((item) => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <span className="hm-sources-list__title">{item.title}</span>
                  <span className="hm-sources-list__host">{hostOf(item.url)}</span>
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </AppModalPortal>
  )
}
