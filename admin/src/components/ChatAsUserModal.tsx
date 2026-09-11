import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, MessageCircle, RefreshCw, Send, X } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import type { UserRow } from '../lib/types'

type RagMatch = {
  similarity?: number | null
  title?: string
  source_url?: string | null
  source_id?: string | null
  content_preview?: string
  content_chars?: number
}

type TimingInfo = {
  evaluator_ms?: number
  rag_embed_ms?: number
  rag_match_ms?: number
  rag_total_ms?: number
  rag_skipped?: boolean
  context_build_ms?: number
  llm_ms?: number
  llm_cost_usd?: number
  llm_transaction_id?: string
  llm_predict_time_s?: number | null
  post_ms?: number
  total_ms?: number
  provider_mode?: string
  failover_errors?: string[]
  rag_error?: string
}

type EvaluatorResult = {
  needs_rag?: boolean
  confidence?: number
  reason?: string
  reason_label?: string
  signals?: string[]
  elapsed_ms?: number
  tool?: string
}

type ChatMsg = {
  role: 'user' | 'assistant'
  content: string
  provider?: string
  timing?: TimingInfo
  matches?: RagMatch[]
  evaluator?: EvaluatorResult
  debug?: Record<string, unknown>
}

type ChatAsPreview = {
  user?: { id?: string; email?: string; name?: string | null; plan?: string | null }
  plan_slot?: string
  entitlements?: Record<string, number>
  context_counts?: { memories?: number; docs?: number; children?: number }
  profile?: { lang?: string; childName?: string | null; dueDate?: string | null }
}

function formatMs(ms?: number | null) {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${Math.round(ms)}ms`
}

function TimingMatchesPanel({
  timing,
  matches,
  evaluator,
  debug,
}: {
  timing?: TimingInfo
  matches?: RagMatch[]
  evaluator?: EvaluatorResult
  debug?: Record<string, unknown>
}) {
  const [open, setOpen] = useState(true)
  if (!timing && !evaluator && !(matches && matches.length)) return null

  const needsRag = evaluator?.needs_rag ?? (debug?.needs_rag as boolean | undefined)
  const ragSkipped = Boolean(timing?.rag_skipped) || needsRag === false

  const rows: { label: string; value: string; emphasize?: boolean }[] = [
    { label: 'Evaluator', value: formatMs(timing?.evaluator_ms ?? evaluator?.elapsed_ms) },
    {
      label: 'RAG embed',
      value: ragSkipped ? 'skipped' : formatMs(timing?.rag_embed_ms),
    },
    {
      label: 'RAG match',
      value: ragSkipped ? 'skipped' : formatMs(timing?.rag_match_ms),
    },
    { label: 'RAG total', value: formatMs(timing?.rag_total_ms) },
    { label: 'Context build', value: formatMs(timing?.context_build_ms) },
    { label: 'LLM', value: formatMs(timing?.llm_ms), emphasize: true },
    {
      label: 'LLM cost',
      value:
        timing?.llm_cost_usd != null ? `$${Number(timing.llm_cost_usd).toFixed(4)}` : '—',
      emphasize: true,
    },
    {
      label: 'LLM predict (provider)',
      value:
        timing?.llm_predict_time_s != null
          ? `${Number(timing.llm_predict_time_s).toFixed(2)}s`
          : '—',
    },
    { label: 'Post', value: formatMs(timing?.post_ms) },
    { label: 'Total', value: formatMs(timing?.total_ms), emphasize: true },
  ]

  const confPct =
    evaluator?.confidence != null && !Number.isNaN(evaluator.confidence)
      ? `${Math.round(evaluator.confidence * 100)}%`
      : null

  return (
    <div className="chat-as-analysis">
      <button type="button" className="chat-as-analysis-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Timing & matches
        {timing?.total_ms != null ? (
          <span className="muted"> · {formatMs(timing.total_ms)} total</span>
        ) : null}
        {evaluator ? (
          <span className="muted">
            {' '}
            · evaluator {needsRag ? 'RAG on' : 'RAG off'}
          </span>
        ) : null}
        {matches?.length ? <span className="muted"> · {matches.length} RAG hit(s)</span> : null}
      </button>
      {open && (
        <div className="chat-as-analysis-body">
          {evaluator ? (
            <div className={`chat-as-evaluator ${needsRag ? 'rag-on' : 'rag-off'}`}>
              <div className="chat-as-evaluator-top">
                <span className="chat-as-evaluator-tool">tool: evaluator</span>
                <span className={`chat-as-evaluator-badge ${needsRag ? 'on' : 'off'}`}>
                  {needsRag ? 'needs RAG' : 'skip RAG'}
                </span>
              </div>
              <div className="chat-as-evaluator-label">
                {evaluator.reason_label || evaluator.reason || '—'}
              </div>
              <div className="chat-as-evaluator-meta muted">
                {confPct ? `confidence ${confPct}` : null}
                {evaluator.reason ? ` · ${evaluator.reason}` : ''}
                {evaluator.elapsed_ms != null ? ` · ${formatMs(evaluator.elapsed_ms)}` : ''}
              </div>
              {evaluator.signals && evaluator.signals.length > 0 ? (
                <div className="chat-as-evaluator-signals muted">
                  signals: {evaluator.signals.slice(0, 6).join(' · ')}
                </div>
              ) : null}
            </div>
          ) : null}

          {timing?.rag_error ? <div className="msg err">RAG: {timing.rag_error}</div> : null}
          {timing?.failover_errors && timing.failover_errors.length > 0 ? (
            <div className="msg err">Failover: {timing.failover_errors.join(' | ')}</div>
          ) : null}
          <div className="chat-as-timing-grid">
            {rows.map((r) => (
              <div key={r.label} className={`chat-as-timing-cell${r.emphasize ? ' emph' : ''}`}>
                <div className="l">{r.label}</div>
                <div className="v">{r.value}</div>
              </div>
            ))}
          </div>
          {timing?.provider_mode ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Mode: {timing.provider_mode}
              {debug?.msg_lang ? ` · lang ${String(debug.msg_lang)}` : ''}
              {debug?.complex_query ? ' · complex query' : ''}
              {debug?.rag_context_chars != null
                ? ` · RAG chars ${String(debug.rag_context_chars)}`
                : ''}
              {timing?.llm_transaction_id
                ? ` · tx ${String(timing.llm_transaction_id).slice(0, 8)}…`
                : ''}
            </div>
          ) : null}

          <div className="chat-as-matches-head">Matched RAG chunks</div>
          {ragSkipped ? (
            <div className="muted" style={{ fontSize: 12 }}>
              RAG skipped by evaluator — no embed / match run.
            </div>
          ) : !matches?.length ? (
            <div className="muted" style={{ fontSize: 12 }}>
              No chunks matched (empty knowledge hit or below threshold).
            </div>
          ) : (
            <div className="chat-as-matches">
              {matches.map((m, i) => (
                <div key={`${m.title}-${i}`} className="chat-as-match">
                  <div className="chat-as-match-top">
                    <strong>
                      #{i + 1} {m.title || '?'}
                    </strong>
                    <span className="badge" style={{ background: '#2D9E6B' }}>
                      {m.similarity != null ? `${(m.similarity * 100).toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  {m.source_url ? (
                    <a href={m.source_url} target="_blank" rel="noreferrer" className="chat-as-match-url">
                      {m.source_url}
                    </a>
                  ) : null}
                  <div className="chat-as-match-preview">{m.content_preview}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ChatAsUserModal({
  user,
  onClose,
}: {
  user: UserRow
  onClose: () => void
}) {
  const { adminFetch } = useAdmin()
  const [preview, setPreview] = useState<ChatAsPreview | null>(null)
  const [previewErr, setPreviewErr] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true)
    setPreviewErr('')
    try {
      const d = (await adminFetch(`/admin/users/${user.id}/chat_as`)) as ChatAsPreview
      setPreview(d)
    } catch (e) {
      setPreviewErr((e instanceof Error && e.message) || 'Failed to load user chat context')
    } finally {
      setLoadingPreview(false)
    }
  }, [adminFetch, user.id])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sending])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSendErr('')
    const nextHistory = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setSending(true)
    try {
      const d = (await adminFetch(`/admin/users/${user.id}/chat_as`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: nextHistory,
          lang: preview?.profile?.lang || 'el',
        }),
      })) as {
        reply?: string
        provider?: string
        timing?: TimingInfo
        matches?: RagMatch[]
        evaluator?: EvaluatorResult
        debug?: Record<string, unknown>
      }
      const reply = typeof d.reply === 'string' ? d.reply.trim() : ''
      if (!reply) throw new Error('Empty reply from chat')
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: reply,
          provider: d.provider,
          timing: d.timing,
          matches: d.matches,
          evaluator: d.evaluator,
          debug: d.debug,
        },
      ])
    } catch (e) {
      const msg = (e instanceof Error && e.message) || 'Chat failed'
      setSendErr(msg)
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const counts = preview?.context_counts
  const planLabel = preview?.plan_slot || user.plan || 'trial'

  return (
    <div className="modal-backdrop" onClick={() => !sending && onClose()} role="presentation">
      <div
        className="modal modal-chat-as"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-as-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="chat-as-title">
            <MessageCircle size={16} className="h-icon" /> Chat like user
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={sending}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body chat-as-body">
          <div className="chat-as-meta">
            <div>
              <strong>{user.email}</strong>
              {user.name ? <span className="muted"> · {user.name}</span> : null}
            </div>
            {loadingPreview ? (
              <div className="muted">Loading context…</div>
            ) : previewErr ? (
              <div className="msg err">{previewErr}</div>
            ) : (
              <div className="chat-as-meta-row">
                <span className="badge" style={{ background: '#2B3A67' }}>
                  {planLabel}
                </span>
                <span className="muted">
                  {(counts?.children ?? 0)} children · {(counts?.memories ?? 0)} memories ·{' '}
                  {(counts?.docs ?? 0)} docs
                  {preview?.profile?.childName ? ` · child: ${preview.profile.childName}` : ''}
                  {preview?.profile?.lang ? ` · lang: ${preview.profile.lang}` : ''}
                </span>
                <button type="button" className="ghost sm" onClick={() => void loadPreview()} disabled={sending}>
                  <RefreshCw size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                  Refresh context
                </button>
              </div>
            )}
            <p className="card-desc" style={{ margin: '8px 0 0' }}>
              Uses this user’s saved family / memories / docs and plan limits. Each reply shows the
              evaluator (RAG on/off), timing, and RAG matches. Does not write their chat history or
              award points.
            </p>
          </div>

          <div className="chat-as-thread">
            {messages.length === 0 && !sending && (
              <div className="chat-as-empty muted">
                Ask something as if you were this user — replies use their context + the live LLM.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={`${m.role}-${i}`} className={`chat-as-msg ${m.role}`}>
                <div className={`chat-as-bubble ${m.role}`}>
                  <div className="chat-as-bubble-text">{m.content}</div>
                  {m.role === 'assistant' && m.provider ? (
                    <div className="chat-as-provider">{m.provider}</div>
                  ) : null}
                </div>
                {m.role === 'assistant' ? (
                  <TimingMatchesPanel
                    timing={m.timing}
                    matches={m.matches}
                    evaluator={m.evaluator}
                    debug={m.debug}
                  />
                ) : null}
              </div>
            ))}
            {sending && <div className="chat-as-typing muted">HeyMaa is thinking…</div>}
            <div ref={bottomRef} />
          </div>

          {sendErr ? <div className="msg err" style={{ marginTop: 8 }}>{sendErr}</div> : null}

          <div className="chat-as-composer">
            <textarea
              ref={inputRef}
              rows={2}
              placeholder="Type a message as this user…"
              value={input}
              disabled={sending || !!previewErr}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <button type="button" onClick={() => void send()} disabled={sending || !input.trim() || !!previewErr}>
              <Send size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
