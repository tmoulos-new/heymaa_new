import { useCallback, useEffect, useState } from 'react'
import { Bot, Brain, GitBranch, RefreshCw, Save } from 'lucide-react'
import { FieldLabel, FormLockBody, FormLockControls, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { apiDetail } from '../lib/api'
import { useEditLock } from '../lib/useEditLock'

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
  places_order: ProviderId[]
  places_keywords: string[]
}

type MemoryContinuity = {
  memories_instruction: string
  milestones_instruction: string
}

type MemoryPlanRow = {
  plan_slot: string
  label_el: string
  label_en: string
  chat_context_messages: number
  memory_context_count: number
  milestone_context_count: number
  memory_video: boolean
}

type MemoryStructure = {
  plans: MemoryPlanRow[]
  sections: { id: string; title: string; what: string; limit_field: string | null }[]
  runtime_rules: string[]
}

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: 'grok', label: 'Grok (xAI)' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'claude', label: 'Claude' },
]

const ORDER_FIELDS: { key: keyof Pick<RoutingConfig, 'default_order' | 'image_order' | 'gemini_first_order' | 'complex_order' | 'places_order'>; label: string; hint: string }[] = [
  { key: 'default_order', label: 'Default order', hint: 'Normal text chats' },
  { key: 'image_order', label: 'Image / photo order', hint: 'When the user sends an image' },
  { key: 'places_order', label: 'Places / nearby order', hint: 'When the user asks for nearby places (Maps grounding on Gemini)' },
  { key: 'gemini_first_order', label: 'Gemini-first language order', hint: 'When message language is in the list below' },
  { key: 'complex_order', label: 'Complex query order', hint: 'Medical keywords or long messages' },
]

const DEFAULT_MEMORY: MemoryContinuity = {
  memories_instruction:
    'Recent memories this user has saved (use naturally if relevant, never list them all at once)',
  milestones_instruction:
    'Development milestones this user has ticked (use naturally if relevant to age or progress, never list them all)',
}

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
  places_order: ['gemini', 'grok', 'claude'],
  places_keywords: [
    'near me',
    'nearby',
    'find me a',
    'find a doctor',
    'find a pediatrician',
    'list of doctors',
    'list of pediatricians',
    'doctors near',
    'doctors in ',
    'pediatrician near',
    'pharmacy near',
    'κοντά μου',
    'βρες μου',
    'βρες γιατρό',
    'λίστα γιατρών',
    'λίστα παιδιάτρων',
    'παιδίατρο κοντά',
    'φαρμακείο κοντά',
    'πού να βρω γιατρό',
    'πού να βρω παιδίατρο',
    'παιδική χαρά',
  ],
}

function applyRoutingState(
  r: RoutingConfig,
  setRouting: (r: RoutingConfig) => void,
  setSavedRouting: (r: RoutingConfig) => void,
  setLangsText: (s: string) => void,
  setKeywordsText: (s: string) => void,
  setPlacesKeywordsText: (s: string) => void,
) {
  const normalized: RoutingConfig = {
    default_order: normalizeOrder(r.default_order),
    image_order: normalizeOrder(r.image_order),
    gemini_first_order: normalizeOrder(r.gemini_first_order),
    complex_order: normalizeOrder(r.complex_order),
    places_order: normalizeOrder(r.places_order || DEFAULT_ROUTING.places_order),
    gemini_first_langs: [...(r.gemini_first_langs || [])],
    complex_keywords: [...(r.complex_keywords || [])],
    places_keywords: [...(r.places_keywords || DEFAULT_ROUTING.places_keywords)],
    complex_min_chars: Number(r.complex_min_chars) || 300,
  }
  setRouting(normalized)
  setSavedRouting(normalized)
  setLangsText((normalized.gemini_first_langs || []).join(', '))
  setKeywordsText((normalized.complex_keywords || []).join('\n'))
  setPlacesKeywordsText((normalized.places_keywords || []).join('\n'))
  return normalized
}

function providerLabel(id: ProviderId): string {
  return PROVIDERS.find((p) => p.id === id)?.label || id
}

function formatOrder(order: ProviderId[]): string {
  return order.map((id) => providerLabel(id).replace(/ \(xAI\)/, '')).join(' → ')
}

function MemoryContinuityFlow() {
  const steps = [
    { label: 'Chat request', muted: true },
    { label: 'Pure greeting?', muted: true },
    { label: 'Family profile', muted: false },
    { label: 'Saved memories (plan N)', muted: false },
    { label: 'Milestones (plan N)', muted: false },
    { label: 'Documents', muted: false },
    { label: 'System prompt → LLM', muted: true },
  ]
  return (
    <div className="memory-flow" aria-label="Memory continuity flow">
      <div className="memory-flow-title">How continuity reaches the model</div>
      <div className="memory-flow-steps">
        {steps.map((s, i) => (
          <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {i > 0 ? <span className="memory-flow-arrow" aria-hidden>→</span> : null}
            <span className={`memory-flow-step${s.muted ? ' muted-step' : ''}`}>{s.label}</span>
          </span>
        ))}
      </div>
      <p className="memory-flow-footer">
        Greetings keep the mother&apos;s name only. Everything else is a rolling window sized by plan —
        not a full archive — so replies feel personal without dumping every saved note.
      </p>
    </div>
  )
}

function RoutingFlowChart({
  routing,
  langsText,
  keywordsText,
  placesKeywordsText,
}: {
  routing: RoutingConfig
  langsText: string
  keywordsText: string
  placesKeywordsText: string
}) {
  const langs = langsText
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const kwCount = keywordsText
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean).length
  const placesKwCount = placesKeywordsText
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean).length
  const langPreview =
    langs.length === 0
      ? 'none'
      : langs.length <= 6
        ? langs.join(', ')
        : `${langs.slice(0, 5).join(', ')} +${langs.length - 5}`

  return (
    <div className="routing-flow" aria-label="LLM routing flowchart">
      <div className="routing-flow-title">How a chat picks a model</div>
      <div className="routing-flow-start">Chat request</div>
      <div className="routing-flow-arrow" aria-hidden>
        ↓
      </div>
      <div className="routing-flow-decision">Has image / photo?</div>
      <div className="routing-flow-branches">
        <div className="routing-flow-branch">
          <span className="routing-flow-edge yes">Yes</span>
          <div className="routing-flow-order">{formatOrder(routing.image_order)}</div>
          <p className="routing-flow-note">Vision-capable models first</p>
        </div>
        <div className="routing-flow-branch">
          <span className="routing-flow-edge no">No</span>
          <div className="routing-flow-decision sm">Places / nearby question?</div>
          <p className="routing-flow-note">
            {placesKwCount} keyword{placesKwCount === 1 ? '' : 's'} (EN + EL). Gemini uses Maps grounding;
            Greek replies via EN search bridge.
          </p>
          <div className="routing-flow-branches nested">
            <div className="routing-flow-branch">
              <span className="routing-flow-edge yes">Yes</span>
              <div className="routing-flow-order">{formatOrder(routing.places_order)}</div>
            </div>
            <div className="routing-flow-branch">
              <span className="routing-flow-edge no">No</span>
              <div className="routing-flow-decision sm">Language in Gemini-first list?</div>
              <p className="routing-flow-note">Codes: {langPreview}</p>
              <div className="routing-flow-branches nested">
                <div className="routing-flow-branch">
                  <span className="routing-flow-edge yes">Yes</span>
                  <div className="routing-flow-order">{formatOrder(routing.gemini_first_order)}</div>
                </div>
                <div className="routing-flow-branch">
                  <span className="routing-flow-edge no">No</span>
                  <div className="routing-flow-decision sm">Complex query?</div>
                  <p className="routing-flow-note">
                    {kwCount} keyword{kwCount === 1 ? '' : 's'} or message longer than{' '}
                    {routing.complex_min_chars} chars
                  </p>
                  <div className="routing-flow-branches nested">
                    <div className="routing-flow-branch">
                      <span className="routing-flow-edge yes">Yes</span>
                      <div className="routing-flow-order">{formatOrder(routing.complex_order)}</div>
                    </div>
                    <div className="routing-flow-branch">
                      <span className="routing-flow-edge no">No</span>
                      <div className="routing-flow-order">{formatOrder(routing.default_order)}</div>
                      <p className="routing-flow-note">Default text chat</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="routing-flow-footer">
        Each step tries the first model with a key configured, then failovers down the arrow.
      </p>
    </div>
  )
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
  const [placesKeywordsText, setPlacesKeywordsText] = useState('')

  const [memory, setMemory] = useState<MemoryContinuity | null>(null)
  const [savedMemory, setSavedMemory] = useState<MemoryContinuity | null>(null)
  const [memoryStructure, setMemoryStructure] = useState<MemoryStructure | null>(null)
  const [memoryMeta, setMemoryMeta] = useState<{
    updated_at?: string | null
    updated_by_name?: string | null
    source?: string
  }>({})
  const [memoryLoading, setMemoryLoading] = useState(true)
  const [memorySaving, setMemorySaving] = useState(false)
  const promptLock = useEditLock()
  const memoryLock = useEditLock()
  const routingLock = useEditLock()

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
        applyRoutingState(DEFAULT_ROUTING, setRouting, setSavedRouting, setLangsText, setKeywordsText, setPlacesKeywordsText)
        setRoutingMeta({ source: 'defaults' })
        return
      }
      const r = d.routing || d.defaults || DEFAULT_ROUTING
      applyRoutingState(r, setRouting, setSavedRouting, setLangsText, setKeywordsText, setPlacesKeywordsText)
      setRoutingMeta({
        updated_at: d.updated_at,
        updated_by_name: d.updated_by_name,
        source: d.source || (d.routing ? 'db' : 'defaults'),
      })
    } catch (e) {
      applyRoutingState(DEFAULT_ROUTING, setRouting, setSavedRouting, setLangsText, setKeywordsText, setPlacesKeywordsText)
      setRoutingMeta({ source: 'defaults' })
      show((e instanceof Error && e.message) || 'Failed to load LLM routing — showing defaults', 'err')
    } finally {
      setRoutingLoading(false)
    }
  }, [adminFetch, show])

  const loadMemory = useCallback(async () => {
    setMemoryLoading(true)
    try {
      const d = (await adminFetch('/admin/chat_memory')) as {
        continuity?: MemoryContinuity
        defaults?: MemoryContinuity
        structure?: MemoryStructure
        updated_at?: string | null
        updated_by_name?: string | null
        source?: string
        error?: string
      }
      if (d.error) {
        show(`Memory error: ${apiDetail(d) || d.error}`, 'err')
        setMemory(DEFAULT_MEMORY)
        setSavedMemory(DEFAULT_MEMORY)
        setMemoryMeta({ source: 'defaults' })
        return
      }
      const c: MemoryContinuity = {
        memories_instruction:
          (d.continuity?.memories_instruction || d.defaults?.memories_instruction || DEFAULT_MEMORY.memories_instruction).trim(),
        milestones_instruction:
          (d.continuity?.milestones_instruction || d.defaults?.milestones_instruction || DEFAULT_MEMORY.milestones_instruction).trim(),
      }
      setMemory(c)
      setSavedMemory(c)
      setMemoryStructure(d.structure || null)
      setMemoryMeta({
        updated_at: d.updated_at,
        updated_by_name: d.updated_by_name,
        source: d.source || (d.continuity ? 'db' : 'defaults'),
      })
    } catch (e) {
      setMemory(DEFAULT_MEMORY)
      setSavedMemory(DEFAULT_MEMORY)
      setMemoryMeta({ source: 'defaults' })
      show((e instanceof Error && e.message) || 'Failed to load memory continuity — showing defaults', 'err')
    } finally {
      setMemoryLoading(false)
    }
  }, [adminFetch, show])

  useEffect(() => {
    void load()
    void loadRouting()
    void loadMemory()
  }, [load, loadRouting, loadMemory])

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
      promptLock.finishEdit()
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
    const placesKeywords = placesKeywordsText
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    const payload: RoutingConfig = {
      ...routing,
      places_order: normalizeOrder(routing.places_order || DEFAULT_ROUTING.places_order),
      gemini_first_langs: langs,
      complex_keywords: keywords,
      places_keywords: placesKeywords,
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
        places_order: normalizeOrder(d.routing.places_order || DEFAULT_ROUTING.places_order),
        gemini_first_langs: [...(d.routing.gemini_first_langs || [])],
        complex_keywords: [...(d.routing.complex_keywords || [])],
        places_keywords: [...(d.routing.places_keywords || DEFAULT_ROUTING.places_keywords)],
        complex_min_chars: Number(d.routing.complex_min_chars) || 300,
      }
      setRouting(normalized)
      setSavedRouting(normalized)
      setLangsText(normalized.gemini_first_langs.join(', '))
      setKeywordsText(normalized.complex_keywords.join('\n'))
      setPlacesKeywordsText(normalized.places_keywords.join('\n'))
      setRoutingMeta({
        updated_at: d.updated_at,
        updated_by_name: d.updated_by_name,
        source: 'db',
      })
      routingLock.finishEdit()
      show('LLM routing saved. New chats will use these rules.', 'ok')
    } catch {
      show('Network error while saving routing', 'err')
    } finally {
      setRoutingSaving(false)
    }
  }

  const saveMemory = async () => {
    if (!memory) return
    const memories_instruction = memory.memories_instruction.trim()
    const milestones_instruction = memory.milestones_instruction.trim()
    if (!memories_instruction || !milestones_instruction) {
      show('Both memory section instructions are required', 'err')
      return
    }
    setMemorySaving(true)
    try {
      const d = (await adminFetch('/admin/chat_memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memories_instruction, milestones_instruction }),
      })) as {
        ok?: boolean
        continuity?: MemoryContinuity
        updated_at?: string
        updated_by_name?: string
        error?: string
      }
      if (!d.ok || !d.continuity) {
        show(`Error: ${apiDetail(d) || d.error || 'Save failed'}`, 'err')
        return
      }
      const c: MemoryContinuity = {
        memories_instruction: (d.continuity.memories_instruction || '').trim(),
        milestones_instruction: (d.continuity.milestones_instruction || '').trim(),
      }
      setMemory(c)
      setSavedMemory(c)
      setMemoryMeta({
        updated_at: d.updated_at,
        updated_by_name: d.updated_by_name,
        source: 'db',
      })
      memoryLock.finishEdit()
      show('Memory continuity instructions saved. New chats will use them.', 'ok')
    } catch {
      show('Network error while saving memory continuity', 'err')
    } finally {
      setMemorySaving(false)
    }
  }

  const dirty = content !== savedContent
  const routingDirty =
    !!routing &&
    !!savedRouting &&
    (JSON.stringify({
      ...routing,
      places_order: normalizeOrder(routing.places_order || DEFAULT_ROUTING.places_order),
      gemini_first_langs: langsText
        .split(/[,\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      complex_keywords: keywordsText
        .split(/[\n,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      places_keywords: placesKeywordsText
        .split(/[\n,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    }) !==
      JSON.stringify({
        ...savedRouting,
        places_order: normalizeOrder(savedRouting.places_order || DEFAULT_ROUTING.places_order),
      }))
  const memoryDirty =
    !!memory &&
    !!savedMemory &&
    (memory.memories_instruction !== savedMemory.memories_instruction ||
      memory.milestones_instruction !== savedMemory.milestones_instruction)

  return (
    <div style={{ display: 'grid', gap: 20, width: '100%' }}>
      {Message}
      <div className="card">
        <div className="card-head">
          <h2>
            <Bot size={16} className="h-icon" /> Chat system prompt
          </h2>
          <div className="card-head-actions">
            <FormLockControls
              editing={promptLock.editing}
              disabled={loading || saving}
              onEdit={promptLock.startEdit}
              onCancel={() =>
                promptLock.cancelEdit(() => {
                  setContent(savedContent)
                })
              }
            />
            <button type="button" className="sec sm" onClick={() => void load()} aria-busy={loading || undefined}>
              <RefreshCw size={14} className={loading ? 'icon-spin' : undefined} style={{ verticalAlign: -2, marginRight: 4 }} />
              Reload
            </button>
          </div>
        </div>
        <p className="card-desc">
          Shared personality instructions sent to <strong>Grok, Gemini, and Claude</strong> on every
          chat. Family, memories, documents, promotions, and RAG context are still appended
          automatically. <strong>Changes affect all chats after Save</strong> — test with Tools →
          Chat Test first.
        </p>
        <div className="admin-callout admin-callout-warn" role="note">
          Save carefully: this is the live system prompt for every mom conversation.
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <FormLockBody editing={promptLock.editing}>
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
              {promptLock.editing ? (
                <button type="button" className="teal" disabled={saving || !dirty} onClick={() => void save()}>
                  <Save size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
                  {saving ? 'Saving…' : 'Save prompt'}
                </button>
              ) : null}
            </div>
          </FormLockBody>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <Brain size={16} className="h-icon" /> Memory &amp; continuity
          </h2>
          <div className="card-head-actions">
            <FormLockControls
              editing={memoryLock.editing}
              disabled={memoryLoading || memorySaving}
              onEdit={memoryLock.startEdit}
              onCancel={() =>
                memoryLock.cancelEdit(() => {
                  if (savedMemory) setMemory(savedMemory)
                })
              }
            />
            <button type="button" className="sec sm" onClick={() => void loadMemory()} aria-busy={memoryLoading || undefined}>
              <RefreshCw size={14} className={memoryLoading ? 'icon-spin' : undefined} style={{ verticalAlign: -2, marginRight: 4 }} />
              Reload
            </button>
          </div>
        </div>
        <p className="card-desc">
          How HeyMaa keeps a personal thread with each mother: what is injected into the system prompt,
          how much of it each plan sends, and the instructions that tell the model to use those notes
          naturally (the continuity / friendship layer).
          {memoryMeta.source === 'defaults' ? ' Section headers are currently using built-in defaults.' : ''}
        </p>
        {memoryLoading || !memory ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <MemoryContinuityFlow />

            <FieldLabel>What gets assembled</FieldLabel>
            <ul className="memory-section-list">
              {(memoryStructure?.sections || []).map((s) => (
                <li key={s.id}>
                  <strong>{s.title}</strong>
                  <span>
                    {s.what}
                    {s.limit_field ? ` Limit field: ${s.limit_field}.` : ' No plan cap (always included when present).'}
                  </span>
                </li>
              ))}
            </ul>

            <FieldLabel>Per-plan window</FieldLabel>
            <p className="muted" style={{ fontSize: 12, margin: '2px 0 8px' }}>
              Marketing labels match FAQ / pricing (Ημερήσια / Βασική / Πλήρης). Limits live in code
              (<code>plan_entitlements</code>) — change them there if product needs a different window.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="memory-plan-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Label</th>
                    <th>Chat msgs</th>
                    <th>Memories</th>
                    <th>Milestones</th>
                    <th>Video</th>
                  </tr>
                </thead>
                <tbody>
                  {(memoryStructure?.plans || []).map((p) => (
                    <tr key={p.plan_slot}>
                      <td><code>{p.plan_slot}</code></td>
                      <td>
                        {p.label_el}
                        <div className="muted" style={{ fontSize: 11 }}>{p.label_en}</div>
                      </td>
                      <td className="num">{p.chat_context_messages}</td>
                      <td className="num">{p.memory_context_count}</td>
                      <td className="num">{p.milestone_context_count}</td>
                      <td>{p.memory_video ? 'Yes' : 'Notes/photos only'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(memoryStructure?.runtime_rules || []).length > 0 ? (
              <>
                <FieldLabel>Runtime rules</FieldLabel>
                <ul className="memory-rules">
                  {memoryStructure!.runtime_rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <FormLockBody editing={memoryLock.editing}>
              <FieldLabel>Memories section instruction</FieldLabel>
              <p className="muted" style={{ fontSize: 12, margin: '2px 0 6px' }}>
                Becomes the <code>--- … ---</code> header above the mother&apos;s saved notes in the system prompt.
              </p>
              <textarea
                value={memory.memories_instruction}
                onChange={(e) => setMemory({ ...memory, memories_instruction: e.target.value })}
                rows={3}
                spellCheck={false}
                style={{
                  width: '100%',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 13,
                  lineHeight: 1.5,
                  resize: 'vertical',
                }}
              />

              <div style={{ marginTop: 14 }}>
                <FieldLabel>Milestones section instruction</FieldLabel>
                <p className="muted" style={{ fontSize: 12, margin: '2px 0 6px' }}>
                  Same pattern for ticked development milestones.
                </p>
                <textarea
                  value={memory.milestones_instruction}
                  onChange={(e) => setMemory({ ...memory, milestones_instruction: e.target.value })}
                  rows={3}
                  spellCheck={false}
                  style={{
                    width: '100%',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 13,
                    lineHeight: 1.5,
                    resize: 'vertical',
                  }}
                />
              </div>

              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  {memoryMeta.updated_at
                    ? `Last saved ${new Date(memoryMeta.updated_at).toLocaleString()}${memoryMeta.updated_by_name ? ` by ${memoryMeta.updated_by_name}` : ''}`
                    : 'Using defaults until saved'}
                  {memoryDirty ? ' · unsaved changes' : ''}
                </span>
                {memoryLock.editing ? (
                  <button
                    type="button"
                    className="teal"
                    disabled={memorySaving || !memoryDirty}
                    onClick={() => void saveMemory()}
                  >
                    <Save size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
                    {memorySaving ? 'Saving…' : 'Save memory instructions'}
                  </button>
                ) : null}
              </div>
            </FormLockBody>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <GitBranch size={16} className="h-icon" /> LLM routing
          </h2>
          <div className="card-head-actions">
            <FormLockControls
              editing={routingLock.editing}
              disabled={routingLoading || routingSaving}
              onEdit={routingLock.startEdit}
              onCancel={() =>
                routingLock.cancelEdit(() => {
                  if (!savedRouting) return
                  setRouting(savedRouting)
                  setLangsText((savedRouting.gemini_first_langs || []).join(', '))
                  setKeywordsText((savedRouting.complex_keywords || []).join('\n'))
                  setPlacesKeywordsText((savedRouting.places_keywords || []).join('\n'))
                })
              }
            />
            <button type="button" className="sec sm" onClick={() => void loadRouting()} aria-busy={routingLoading || undefined}>
              <RefreshCw size={14} className={routingLoading ? 'icon-spin' : undefined} style={{ verticalAlign: -2, marginRight: 4 }} />
              Reload
            </button>
          </div>
        </div>
        <p className="card-desc">
          Which model is tried first, then failover order. Drag to reorder; missing API keys are
          skipped automatically. Keyword routes can force a provider for specific topics (e.g. places).
          {routingMeta.source === 'defaults' ? ' Currently using built-in defaults until you Save.' : ''}
        </p>
        {routingLoading || !routing ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <RoutingFlowChart
              routing={routing}
              langsText={langsText}
              keywordsText={keywordsText}
              placesKeywordsText={placesKeywordsText}
            />

            <FormLockBody editing={routingLock.editing}>
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
              <FieldLabel>Places / nearby keywords</FieldLabel>
              <p className="muted" style={{ fontSize: 12, margin: '2px 0 6px' }}>
                One per line (EN + Greek). Triggers Gemini-first routing with Google Maps grounding.
                Non-English replies use an English Maps search bridge, then answer in the user language.
              </p>
              <textarea
                value={placesKeywordsText}
                onChange={(e) => setPlacesKeywordsText(e.target.value)}
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
              {routingLock.editing ? (
                <button
                  type="button"
                  className="teal"
                  disabled={routingSaving || !routingDirty}
                  onClick={() => void saveRouting()}
                >
                  <Save size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
                  {routingSaving ? 'Saving…' : 'Save routing'}
                </button>
              ) : null}
            </div>
            </FormLockBody>
          </>
        )}
      </div>
    </div>
  )
}
