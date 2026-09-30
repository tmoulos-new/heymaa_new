import { useEffect } from 'react'
import { AppModalPortal } from './AppModalPortal'

export type ChatSourceLink = {
  title: string
  url: string
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
  const isEl = lang === 'el'

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
        <button type="button" className="hm-sources-backdrop" aria-label={isEl ? 'Κλείσιμο' : 'Close'} onClick={onClose} />
        <aside className="hm-sources-drawer" role="dialog" aria-modal="true" aria-label={isEl ? 'Πηγές' : 'Sources'}>
          <div className="hm-sources-drawer__head">
            <div>
              <h2>{isEl ? 'Πηγές' : 'Sources'}</h2>
              <p>{isEl ? 'Σελίδες που στήριξαν αυτή την απάντηση.' : 'Pages that backed this answer.'}</p>
            </div>
            <button type="button" className="hm-sources-drawer__close" onClick={onClose} aria-label={isEl ? 'Κλείσιμο' : 'Close'}>
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
