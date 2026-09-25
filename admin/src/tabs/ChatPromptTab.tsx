import { useCallback, useEffect, useState } from 'react'
import { Bot, GitBranch, RefreshCw, Save } from 'lucide-react'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { apiDetail } from '../lib/api'

type PromptRow = {
  content: string
  updated_at?: string | null
  updated_by_name?: string | null
  source?: string
}

type ProviderId = 'grok' | 'gemini' | 'claude'

type RoutingConfig = {
  default_order: ProviderId[]
  image_order: ProviderId[]
  gemini_first_langs: string[]
  gemini_first_order: ProviderId[]
  complex_order: ProviderId[]
  complex_keywords: string[]
  complex_min_chars: number
}

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: 'grok', label: 'Grok (xAI)' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'claude', label: 'Claude' },
]

const ORDER_FIELDS: { key: keyof Pick<RoutingConfig, 'default_order' | 'image_order' | 'gemini_first_order' | 'complex_order'>; label: string; hint: string }[] = [
  { key: 'default_order', label: 'Default order', hint: 'Normal text chats' },
  { key: 'image_order', label: 'Image / photo order', hint: 'When the user sends an image' },
  { key: 'gemini_first_order', label: 'Gemini-first language order', hint: 'When message language is in the list below' },
  { key: 'complex_order', label: 'Complex query order', hint: 'Medical keywords or long messages' },
]

function normalizeOrder(order: string[] | undefined): ProviderId[] {
  const allowed = new Set<ProviderId>(['grok', 'gemini', 'claude'])
  const out: ProviderId[] = []
  for (const item of order || []) {
    const id = String(item || '').toLowerCase() as ProviderId
    if (allowed.has(id) && !out.includes(id)) out.push(id)
  }
  for (const id of ['grok', 'gemini', 'claude'] as ProviderId[]) {
    if (!out.includes(id)) out.push(id)
  }
  return out
}

const DEFAULT_ROUTING: RoutingConfig = {
  default_order: ['grok', 'gemini', 'claude'],
  image_order: ['gemini', 'claude', 'grok'],
  gemini_first_langs: ['ar', 'zh', 'ja', 'hi', 'ur', 'bn', 'mr', 'te', 'fil', 'sw'],
  gemini_first_order: ['gemini', 'grok', 'claude'],
  complex_order: ['grok', 'gemini', 'claude'],
  complex_keywords: [
    'diagnosis',
    'symptoms',
    'emergency',
    'medication',
    'fever',
    'hospital',
    'allergy',
    'depression',
    'anxiety',
  ],
  complex_min_chars: 300,
}

function applyRoutingState(
  r: RoutingConfig,
  setRouting: (r: RoutingConfig) => void,
  setSavedRouting: (r: RoutingConfig) => void,
  setLangsText: (s: string) => void,
  setKeywordsText: (s: string) => void,
) {
  const normalized: RoutingConfig = {
    default_order: normalizeOrder(r.default_order),
    image_order: normalizeOrder(r.image_order),
    gemini_first_order: normalizeOrder(r.gemini_first_order),
    complex_order: normalizeOrder(r.complex_order),
    gemini_first_langs: [...(r.gemini_first_langs || [])],
    complex_keywords: [...(r.complex_keywords || [])],
    complex_min_chars: Number(r.complex_min_chars) || 300,
  }
  setRouting(normalized)
  setSavedRouting(normalized)
  setLangsText((normalized.gemini_first_langs || []).join(', '))
  setKeywordsText((normalized.complex_keywords || []).join('\n'))
  return normalized
}

function OrderEditor({
  value,
  onChange,
}: {
  value: ProviderId[]
  onChange: (next: ProviderId[]) => void
}) {
  const move = (index: number, dir: -1 | 1) => {
    const next = [...value]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    onChange(next)
  }
  return (
    <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
      {value.map((id, i) => {
        const label = PROVIDERS.find((p) => p.id === id)?.label || id
        return (
          <li key={id} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ minWidth: 140 }}>{i + 1}. {label}</span>
            <button type="button" className="sec sm" disabled={i === 0} onClick={() => move(i, -1)}>
              Up
            </button>
            <button type="button" className="sec sm" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
              Down
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function ChatPromptTab() {
  const { adminFetch } = useAdmin()
  const { show, Message } = useFlashMessage()
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [meta, setMeta] = useState<{ updated_at?: string | null; updated_by_name?: string | null }>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [routing, setRouting] = useState<RoutingConfig | null>(null)
  const [savedRouting, setSavedRouting] = useState<RoutingConfig | null>(null)
  const [routingMeta, setRoutingMeta] = useState<{
    updated_at?: string | null
    updated_by_name?: string | null
    source?: string
  }>({})
  const [routingLoading, setRoutingLoading] = useState(true)
  const [routingSaving, setRoutingSaving] = useState(false)
  const [langsText, setLangsText] = useState('')
  const [keywordsText, setKeywordsText] = useState('')

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

  const loadRouting = useCallback(async () => {
    setRoutingLoading(true)
    try {
      const d = (await adminFetch('/admin/llm_routing')) as {
        routing?: RoutingConfig
        defaults?: RoutingConfig
        updated_at?: string | null
        updated_by_name?: string | null
        source?: string
        error?: string
      }
      if (d.error) {
        show(`Routing error: ${apiDetail(d) || d.error}`, 'err')
        applyRoutingState(DEFAULT_ROUTING, setRouting, setSavedRouting, setLangsText, setKeywordsText)
        setRoutingMeta({ source: 'defaults' })
        return
      }
      const r = d.routing || d.defaults || DEFAULT_ROUTING
      applyRoutingState(r, setRouting, setSavedRouting, setLangsText, setKeywordsText)
      setRoutingMeta({
        updated_at: d.updated_at,
        updated_by_name: d.updated_by_name,
        source: d.source || (d.routing ? 'db' : 'defaults'),
      })
    } catch (e) {
      applyRoutingState(DEFAULT_ROUTING, setRouting, setSavedRouting, setLangsText, setKeywordsText)
      setRoutingMeta({ source: 'defaults' })
      show((e instanceof Error && e.message) || 'Failed to load LLM routing — showing defaults', 'err')
    } finally {
      setRoutingLoading(false)
    }
  }, [adminFetch, show])

  useEffect(() => {
    void load()
    void loadRouting()
  }, [load, loadRouting])

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

  const saveRouting = async () => {
    if (!routing) return
    const langs = langsText
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    const keywords = keywordsText
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    const payload: RoutingConfig = {
      ...routing,
      gemini_first_langs: langs,
      complex_keywords: keywords,
      complex_min_chars: Math.max(50, Math.min(Number(routing.complex_min_chars) || 300, 5000)),
    }
    setRoutingSaving(true)
    try {
      const d = (await adminFetch('/admin/llm_routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routing: payload }),
      })) as { ok?: boolean; routing?: RoutingConfig; updated_at?: string; updated_by_name?: string; error?: string }
      if (!d.ok || !d.routing) {
        show(`Error: ${apiDetail(d) || d.error || 'Save failed'}`, 'err')
        return
      }
      const normalized: RoutingConfig = {
        default_order: normalizeOrder(d.routing.default_order),
        image_order: normalizeOrder(d.routing.image_order),
        gemini_first_order: normalizeOrder(d.routing.gemini_first_order),
        complex_order: normalizeOrder(d.routing.complex_order),
        gemini_first_langs: [...(d.routing.gemini_first_langs || [])],
        complex_keywords: [...(d.routing.complex_keywords || [])],
        complex_min_chars: Number(d.routing.complex_min_chars) || 300,
      }
      setRouting(normalized)
      setSavedRouting(normalized)
      setLangsText(normalized.gemini_first_langs.join(', '))
      setKeywordsText(normalized.complex_keywords.join('\n'))
      setRoutingMeta({
        updated_at: d.updated_at,
        updated_by_name: d.updated_by_name,
        source: 'db',
      })
      show('LLM routing saved. New chats will use these rules.', 'ok')
    } catch {
      show('Network error while saving routing', 'err')
    } finally {
      setRoutingSaving(false)
    }
  }

  const dirty = content !== savedContent
  const routingDirty =
    !!routing &&
    !!savedRouting &&
    (JSON.stringify({
      ...routing,
      gemini_first_langs: langsText
        .split(/[,\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      complex_keywords: keywordsText
        .split(/[\n,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    }) !==
      JSON.stringify(savedRouting))

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 960 }}>
      <div className="card">
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
          Shared personality instructions sent to <strong>Grok, Gemini, and Claude</strong> on every chat.
          Family, memories, documents, promotions, and RAG context are still appended automatically.
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
              rows={18}
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

      <div className="card">
        <div className="card-head">
          <h2>
            <GitBranch size={16} className="h-icon" /> LLM routing
          </h2>
          <button type="button" className="sec sm" onClick={() => void loadRouting()} disabled={routingLoading}>
            <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
            Reload
          </button>
        </div>
        <p className="card-desc">
          Which model is tried first (then failover). Missing API keys are skipped automatically.
          {routingMeta.source === 'defaults' ? ' Currently using built-in defaults.' : ''}
        </p>
        {routingLoading || !routing ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            {ORDER_FIELDS.map((field) => (
              <div key={field.key} style={{ marginBottom: 18 }}>
                <FieldLabel>{field.label}</FieldLabel>
                <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>{field.hint}</p>
                <OrderEditor
                  value={routing[field.key]}
                  onChange={(next) => setRouting({ ...routing, [field.key]: next })}
                />
              </div>
            ))}

            <FieldLabel>Gemini-first languages</FieldLabel>
            <p className="muted" style={{ fontSize: 12, margin: '2px 0 6px' }}>
              Comma-separated language codes (e.g. ar, zh, ja). Detected from the user message.
            </p>
            <input
              type="text"
              value={langsText}
              onChange={(e) => setLangsText(e.target.value)}
              style={{ width: '100%' }}
            />

            <div style={{ marginTop: 16 }}>
              <FieldLabel>Complex query keywords</FieldLabel>
              <p className="muted" style={{ fontSize: 12, margin: '2px 0 6px' }}>
                One per line (or comma-separated). Match is case-insensitive substring.
              </p>
              <textarea
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                rows={6}
                spellCheck={false}
                style={{
                  width: '100%',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 13,
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginTop: 16, maxWidth: 220 }}>
              <FieldLabel>Complex min characters</FieldLabel>
              <input
                type="number"
                min={50}
                max={5000}
                value={routing.complex_min_chars}
                onChange={(e) =>
                  setRouting({ ...routing, complex_min_chars: Number(e.target.value) || 300 })
                }
              />
            </div>

            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {routingMeta.updated_at
                  ? `Last saved ${new Date(routingMeta.updated_at).toLocaleString()}${routingMeta.updated_by_name ? ` by ${routingMeta.updated_by_name}` : ''}`
                  : 'Using defaults until saved'}
                {routingDirty ? ' · unsaved changes' : ''}
              </span>
              <button
                type="button"
                className="teal"
                disabled={routingSaving || !routingDirty}
                onClick={() => void saveRouting()}
              >
                <Save size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
                {routingSaving ? 'Saving…' : 'Save routing'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
