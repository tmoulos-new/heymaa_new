import { useRef } from 'react'
import { Bold, Italic, List, Sparkles, Type } from 'lucide-react'

type Props = {
  value: string
  onChange: (next: string) => void
  maxLength?: number
  rows?: number
  placeholder?: string
}

function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  emptyPlaceholder = 'text',
) {
  const selected = value.slice(start, end) || emptyPlaceholder
  const next = value.slice(0, start) + before + selected + after + value.slice(end)
  const cursorStart = start + before.length
  const cursorEnd = cursorStart + selected.length
  return { next, cursorStart, cursorEnd }
}

export function EmailBodyEditor({ value, onChange, maxLength = 4000, rows = 9, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const apply = (mutate: (v: string, start: number, end: number) => { next: string; cursorStart: number; cursorEnd: number }) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const { next, cursorStart, cursorEnd } = mutate(value, start, end)
    const clipped = next.slice(0, maxLength)
    onChange(clipped)
    requestAnimationFrame(() => {
      if (!ref.current) return
      ref.current.focus()
      ref.current.setSelectionRange(cursorStart, Math.min(cursorEnd, clipped.length))
    })
  }

  const insertSnippet = (snippet: string) => {
    apply((v, start, end) => {
      const prefix = start > 0 && !/\n$/.test(v.slice(0, start)) ? '\n\n' : ''
      const insert = prefix + snippet
      const next = v.slice(0, start) + insert + v.slice(end)
      const pos = start + insert.length
      return { next, cursorStart: pos, cursorEnd: pos }
    })
  }

  return (
    <div className="email-body-editor">
      <div className="email-body-editor__shell">
        <div className="email-body-editor__toolbar" role="toolbar" aria-label="Message formatting">
          <div className="email-body-editor__group" aria-label="Format">
            <button
              type="button"
              className="email-body-editor__tool"
              title="Bold"
              onClick={() => apply((v, s, e) => wrapSelection(v, s, e, '**', '**', 'important'))}
            >
              <Bold size={15} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className="email-body-editor__tool"
              title="Italic"
              onClick={() => apply((v, s, e) => wrapSelection(v, s, e, '*', '*', 'emphasis'))}
            >
              <Italic size={15} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className="email-body-editor__tool"
              title="Bullet list"
              onClick={() =>
                apply((v, s, e) => {
                  const selected = v.slice(s, e) || 'Point one\nPoint two'
                  const bullets = selected
                    .split('\n')
                    .map((line) => {
                      const t = line.trim()
                      if (!t) return ''
                      return t.startsWith('- ') ? t : `- ${t}`
                    })
                    .filter(Boolean)
                    .join('\n')
                  const next = v.slice(0, s) + bullets + v.slice(e)
                  return { next, cursorStart: s, cursorEnd: s + bullets.length }
                })
              }
            >
              <List size={15} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className="email-body-editor__tool email-body-editor__tool--wide"
              title="Insert {name}"
              onClick={() =>
                apply((v, s, e) => {
                  const next = v.slice(0, s) + '{name}' + v.slice(e)
                  const pos = s + 6
                  return { next, cursorStart: pos, cursorEnd: pos }
                })
              }
            >
              <Type size={14} strokeWidth={2.25} />
              <span>{'{name}'}</span>
            </button>
          </div>
          <div className="email-body-editor__group email-body-editor__group--chips" aria-label="Snippets">
            <button type="button" className="email-body-editor__chip" onClick={() => insertSnippet('Hi {name},\n\n')}>
              Greeting
            </button>
            <button
              type="button"
              className="email-body-editor__chip"
              onClick={() => insertSnippet('Here’s what’s new:\n- \n- \n')}
            >
              What’s new
            </button>
            <button
              type="button"
              className="email-body-editor__chip"
              onClick={() =>
                insertSnippet('If you need anything, just reply to this email — we’re here.\n')
              }
            >
              Soft close
            </button>
          </div>
        </div>
        <textarea
          ref={ref}
          value={value}
          maxLength={maxLength}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      <div className="email-body-editor__meta">
        <span>**bold** · *italic* · - lists · {'{name}'} personalizes the greeting</span>
        <span>{value.length.toLocaleString()}/{maxLength.toLocaleString()}</span>
      </div>
    </div>
  )
}

type AiProps = {
  open: boolean
  onToggle: () => void
  brief: string
  onBriefChange: (v: string) => void
  tone: string
  onToneChange: (v: string) => void
  lang: string
  onLangChange: (v: string) => void
  busy: boolean
  onDraft: () => void
}

export function EmailAiAssist({
  open,
  onToggle,
  brief,
  onBriefChange,
  tone,
  onToneChange,
  lang,
  onLangChange,
  busy,
  onDraft,
}: AiProps) {
  return (
    <div className={`email-ai${open ? ' email-ai--open' : ''}`}>
      <div className="email-ai__bar">
        <div className="email-ai__intro">
          <span className="email-ai__badge" aria-hidden="true">
            <Sparkles size={14} />
          </span>
          <div>
            <strong>AI writing assist</strong>
            <p>Optional — draft subject, message, and button from a short brief.</p>
          </div>
        </div>
        <button type="button" className={open ? 'sec sm' : 'teal sm'} onClick={onToggle}>
          {open ? 'Hide' : 'Draft with AI'}
        </button>
      </div>
      {open ? (
        <div className="email-ai__panel">
          <label className="email-ai__brief-label" htmlFor="email-ai-brief">
            What should this email do?
          </label>
          <textarea
            id="email-ai-brief"
            value={brief}
            maxLength={1200}
            rows={3}
            onChange={(e) => onBriefChange(e.target.value)}
            placeholder="e.g. Remind trial users their access ends in 3 days and invite them to subscribe"
          />
          <div className="email-ai__row">
            <label>
              Tone
              <select value={tone} onChange={(e) => onToneChange(e.target.value)}>
                <option value="warm">Warm</option>
                <option value="promo">Promo</option>
                <option value="reminder">Reminder</option>
                <option value="support">Support</option>
              </select>
            </label>
            <label>
              Language
              <select value={lang} onChange={(e) => onLangChange(e.target.value)}>
                <option value="en">English</option>
                <option value="el">Greek</option>
              </select>
            </label>
            <button
              type="button"
              className="teal"
              disabled={busy || brief.trim().length < 8}
              onClick={onDraft}
            >
              <Sparkles size={14} aria-hidden="true" />
              {busy ? 'Drafting…' : 'Generate draft'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
