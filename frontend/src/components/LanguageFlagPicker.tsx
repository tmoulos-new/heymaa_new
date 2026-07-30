import { LANGS, mf } from '../home/homeContent'
import '../home/home.css'

function FlagHtml({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

export function LanguageFlagGrid({
  currentLang,
  onSelect,
  className = '',
}: {
  currentLang: string
  onSelect: (code: string) => void
  className?: string
}) {
  return (
    <div className={`flag-grid${className ? ` ${className}` : ''}`}>
      {LANGS.map((l) => (
        <button
          type="button"
          key={l.code}
          className={`flag-item${l.code === currentLang ? ' active' : ''}`}
          onClick={() => onSelect(l.code)}
        >
          <FlagHtml html={mf(l.code, 40, 27)} />
          <span className="flag-lname">{l.name}</span>
          <span className="flag-lvoice">{l.voice}</span>
          <span className="active-pip" />
        </button>
      ))}
    </div>
  )
}

export function LanguageFlagOverlay({
  open,
  title,
  currentLang,
  onClose,
  onSelect,
}: {
  open: boolean
  title: string
  currentLang: string
  onClose: () => void
  onSelect: (code: string) => void
}) {
  return (
    <div
      className={`lang-overlay${open ? ' open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div className="lang-box">
        <div className="lang-box-hdr">
          <div className="lang-box-title">{title}</div>
          <button type="button" className="lang-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <LanguageFlagGrid
          currentLang={currentLang}
          onSelect={(code) => {
            onSelect(code)
            onClose()
          }}
        />
      </div>
    </div>
  )
}
