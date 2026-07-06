import { useCallback, useEffect, useState } from 'react'
import { Bot, RefreshCw, Save } from 'lucide-react'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { apiDetail } from '../lib/api'

type PromptRow = {
  content: string
  updated_at?: string | null
  updated_by_name?: string | null
  source?: string
}

export function ChatPromptTab() {
  const { adminFetch } = useAdmin()
  const { show, Message } = useFlashMessage()
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [meta, setMeta] = useState<{ updated_at?: string | null; updated_by_name?: string | null }>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = (await adminFetch('/admin/chat_prompt')) as PromptRow & { error?: string }
      if (d.error) {
        show(`Error: ${apiDetail(d) || d.error}`, 'err')
        return
      }
      setContent(d.content || '')
      setSavedContent(d.content || '')
      setMeta({ updated_at: d.updated_at, updated_by_name: d.updated_by_name })
    } catch {
      show('Failed to load chat prompt', 'err')
    } finally {
      setLoading(false)
    }
  }, [adminFetch, show])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    const trimmed = content.trim()
    if (!trimmed) {
      show('Prompt cannot be empty', 'err')
      return
    }
    setSaving(true)
    try {
      const d = (await adminFetch('/admin/chat_prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })) as PromptRow & { ok?: boolean; error?: string }
      if (!d.ok) {
        show(`Error: ${apiDetail(d) || d.error || 'Save failed'}`, 'err')
        return
      }
      setContent(trimmed)
      setSavedContent(trimmed)
      setMeta({ updated_at: d.updated_at, updated_by_name: d.updated_by_name })
      show('Chat prompt saved. New chats will use this version.', 'ok')
    } catch {
      show('Network error while saving', 'err')
    } finally {
      setSaving(false)
    }
  }

  const dirty = content !== savedContent

  return (
    <div className="card" style={{ maxWidth: 960 }}>
      <div className="card-head">
        <h2>
          <Bot size={16} className="h-icon" /> Chat system prompt
        </h2>
        <button type="button" className="sec sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
          Reload
        </button>
      </div>
      <p className="card-desc">
        Base instructions sent to the AI on every chat request. Family, memories, documents, promotions,
        and RAG context are still appended automatically at runtime.
      </p>
      {Message}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <FieldLabel>Instructions</FieldLabel>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={22}
            spellCheck={false}
            style={{
              width: '100%',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 13,
              lineHeight: 1.5,
              resize: 'vertical',
            }}
          />
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {meta.updated_at
                ? `Last saved ${new Date(meta.updated_at).toLocaleString()}${meta.updated_by_name ? ` by ${meta.updated_by_name}` : ''}`
                : 'Not saved yet'}
              {dirty ? ' · unsaved changes' : ''}
            </span>
            <button type="button" className="teal" disabled={saving || !dirty} onClick={() => void save()}>
              <Save size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
              {saving ? 'Saving…' : 'Save prompt'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
