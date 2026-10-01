import { useCallback, useEffect, useMemo, useState } from 'react'
import { Headphones, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { apiDetail } from '../lib/api'
import { pathForTab } from '../lib/constants'

type Thread = {
  id: string
  subject: string
  category: string
  status: string
  email: string
  name?: string | null
  user_id?: string | null
  last_message_at?: string
  created_at?: string
}

type Msg = {
  id: string
  sender_role: string
  body: string
  created_at?: string
}

function fmt(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

export function SupportInboxTab() {
  const { adminFetch } = useAdmin()
  const { show, Message } = useFlashMessage()
  const navigate = useNavigate()
  const [status, setStatus] = useState('open_queue')
  const [q, setQ] = useState('')
  const [threads, setThreads] = useState<Thread[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [selected, setSelected] = useState<Thread | null>(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const d = await adminFetch(`/admin/support/threads?status=${encodeURIComponent(status)}`)
      setThreads((d.threads as Thread[]) || [])
      setOpenCount(Number(d.open_count || 0))
    } catch (e) {
      setErr(apiDetail(e) || 'Failed to load support inbox. Run migrations/support_messages.sql if needed.')
      setThreads([])
    } finally {
      setLoading(false)
    }
  }, [adminFetch, status])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return threads
    return threads.filter((t) => {
      const hay = `${t.subject} ${t.email} ${t.name || ''} ${t.category}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [threads, q])

  const openThread = async (id: string) => {
    setBusy(true)
    setErr('')
    try {
      const d = await adminFetch(`/admin/support/threads/${id}`)
      setSelectedId(id)
      setSelected(d.thread as Thread)
      setMessages((d.messages as Msg[]) || [])
      setReply('')
    } catch (e) {
      show(apiDetail(e) || 'Could not open thread', 'err')
    } finally {
      setBusy(false)
    }
  }

  const sendReply = async () => {
    if (!selectedId || reply.trim().length < 10) return
    setBusy(true)
    try {
      const d = await adminFetch(`/admin/support/threads/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      })
      setMessages((prev) => [...prev, d.message as Msg])
      setSelected(d.thread as Thread)
      setReply('')
      show('Reply sent (email + in-app)', 'ok')
      void load()
    } catch (e) {
      show(apiDetail(e) || 'Reply failed', 'err')
    } finally {
      setBusy(false)
    }
  }

  const setThreadStatus = async (next: string) => {
    if (!selectedId) return
    setBusy(true)
    try {
      const d = await adminFetch(`/admin/support/threads/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      setSelected(d.thread as Thread)
      show(`Marked ${next}`, 'ok')
      void load()
    } catch (e) {
      show(apiDetail(e) || 'Status update failed', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">
              <Headphones size={18} style={{ marginRight: 8, verticalAlign: -3 }} />
              Support inbox
              {openCount > 0 ? (
                <span className="nav-badge" style={{ marginLeft: 8 }}>
                  {openCount > 99 ? '99+' : openCount}
                </span>
              ) : null}
            </h2>
            <p className="card-desc">
              Messages moms send from <strong>Help &amp; contact</strong> in the app. Reply here —
              they get an email and can continue the thread in the app. Not for medical emergencies;
              keep personal data minimal. Rate limits apply on the user side.
            </p>
          </div>
          <button type="button" className="sec sm" onClick={() => void load()} aria-busy={loading || undefined}>
            <RefreshCw size={14} className={loading ? 'icon-spin' : undefined} style={{ verticalAlign: -2, marginRight: 4 }} /> Refresh
          </button>
        </div>
        {Message}
        <div className="admin-howto" role="note">
          <div className="admin-howto-title">Process</div>
          <ol className="admin-howto-steps">
            <li>
              <strong>Triage</strong>
              <span>Open queue = new or waiting on admin. Check category (billing vs technical).</span>
            </li>
            <li>
              <strong>Reply</strong>
              <span>Write a clear answer. We email the mom and show it under My messages in the app.</span>
            </li>
            <li>
              <strong>Close</strong>
              <span>When resolved, mark Closed. They can still start a new message later.</span>
            </li>
          </ol>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <FieldLabel>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open_queue">Open queue</option>
              <option value="open">Open</option>
              <option value="pending_admin">Pending admin</option>
              <option value="pending_user">Pending user</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </select>
          </FieldLabel>
          <FieldLabel>
            Search
            <input
              type="search"
              placeholder="Email, name, subject…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </FieldLabel>
        </div>

        {err ? <p className="err">{err}</p> : null}
        {loading ? <p className="meta">Loading…</p> : null}

        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div>
            {!loading && !filtered.length ? (
              <div className="empty">No threads in this filter.</div>
            ) : null}
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`list-item${selectedId === t.id ? ' is-active' : ''}`}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8 }}
                onClick={() => void openThread(t.id)}
              >
                <div className="t">
                  {t.subject}
                  <span className="badge badge-muted" style={{ marginLeft: 8 }}>
                    {t.status}
                  </span>
                </div>
                <div className="b">
                  {(t.name || t.email) + ` · ${t.category} · ${fmt(t.last_message_at)}`}
                </div>
              </button>
            ))}
          </div>

          <div className="card" style={{ margin: 0 }}>
            {!selected ? (
              <p className="meta">Select a thread to read and reply.</p>
            ) : (
              <>
                <div className="card-head">
                  <h3 style={{ margin: 0, fontSize: 16 }}>{selected.subject}</h3>
                </div>
                <p className="card-desc" style={{ marginTop: 0 }}>
                  {selected.name || '—'} · {selected.email} · {selected.category} · {selected.status}
                </p>
                <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {selected.user_id ? (
                    <button
                      type="button"
                      className="ghost sm"
                      onClick={() =>
                        navigate(`${pathForTab('users')}?q=${encodeURIComponent(selected.email || '')}`)
                      }
                    >
                      Open user
                    </button>
                  ) : null}
                  {selected.status !== 'closed' ? (
                    <button
                      type="button"
                      className="sec sm"
                      disabled={busy}
                      onClick={() => void setThreadStatus('closed')}
                    >
                      Close thread
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="sec sm"
                      disabled={busy}
                      onClick={() => void setThreadStatus('open')}
                    >
                      Reopen
                    </button>
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: 320,
                    overflow: 'auto',
                    marginBottom: 12,
                  }}
                >
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        background:
                          m.sender_role === 'admin' ? 'rgba(74,190,170,.12)' : 'rgba(43,58,103,.05)',
                        fontSize: 13,
                        lineHeight: 1.45,
                      }}
                    >
                      <div className="meta" style={{ marginBottom: 4 }}>
                        {m.sender_role === 'admin' ? 'Admin' : 'User'} · {fmt(m.created_at)}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    </div>
                  ))}
                </div>
                {selected.status !== 'closed' ? (
                  <>
                    <FieldLabel>Reply to mom</FieldLabel>
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={4}
                      placeholder="Clear, kind answer. Avoid asking for unnecessary sensitive medical data."
                    />
                    <button
                      type="button"
                      className="teal"
                      style={{ marginTop: 8 }}
                      disabled={busy || reply.trim().length < 10}
                      onClick={() => void sendReply()}
                    >
                      Send reply (email + app)
                    </button>
                  </>
                ) : (
                  <p className="meta">Thread closed. Reopen to send another reply.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
