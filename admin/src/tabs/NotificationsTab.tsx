import { useEffect, useMemo, useState } from 'react'
import { Bell, Eye, RefreshCw, Search, Send } from 'lucide-react'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { ComposerPreview } from '../components/ComposerPreview'
import { useAdmin } from '../context/AdminContext'

type UserHit = {
  id: string
  email?: string
  name?: string
  plan?: string
  subscription_status?: string
}

type Campaign = {
  id: string
  title: string
  body: string
  url?: string | null
  audience?: string
  audience_label?: string
  recipient_count?: number
  read_count?: number
  push_attempted?: number
  push_delivered?: number
  push_failed?: number
  last_error?: string | null
  created_at?: string
}

type PushStatus = {
  configured?: boolean
  devices?: number
  error?: string
}

function fmt(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

export function NotificationsTab() {
  const { adminFetch } = useAdmin()
  const { show, Message } = useFlashMessage()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [audience, setAudience] = useState<'selected' | 'all' | 'plan'>('selected')
  const [plan, setPlan] = useState('trial')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<UserHit[]>([])
  const [picked, setPicked] = useState<UserHit[]>([])
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<Campaign[]>([])
  const [setupError, setSetupError] = useState('')
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<{ title: string; body: string; url: string } | null>(null)

  const pickedIds = useMemo(() => new Set(picked.map((u) => u.id)), [picked])

  const load = async () => {
    setLoading(true)
    try {
      const [list, status] = await Promise.all([
        adminFetch('/admin/notifications'),
        adminFetch('/admin/notifications/status').catch(() => null),
      ])
      setHistory((list.notifications as Campaign[]) || [])
      setSetupError(list.error ? String(list.error) : '')
      if (status) setPushStatus(status as PushStatus)
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not load notifications', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    const handle = window.setTimeout(() => {
      void adminFetch(`/admin/notifications/users?q=${encodeURIComponent(q)}`)
        .then((d) => setHits((d.users as UserHit[]) || []))
        .catch(() => setHits([]))
    }, 250)
    return () => window.clearTimeout(handle)
  }, [query, adminFetch])

  const send = async () => {
    if (audience === 'selected' && picked.length === 0) {
      show('Pick at least one person, or choose another audience', 'err')
      return
    }
    setSending(true)
    try {
      const d = await adminFetch('/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || undefined,
          audience,
          user_ids: picked.map((u) => u.id),
          plan: audience === 'plan' ? plan : undefined,
        }),
      })
      const note = (d.notification || {}) as Campaign
      show(
        `Sent to ${note.recipient_count ?? 0} people · push delivered ${note.push_delivered ?? 0}/${note.push_attempted ?? 0}`,
        'ok',
      )
      setTitle('')
      setBody('')
      setUrl('')
      setPicked([])
      await load()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Send failed', 'err')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {Message}
      <div className="card">
        <div className="card-head">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Bell size={18} />
              How delivery works
            </h2>
            <p className="card-desc" style={{ margin: '6px 0 0' }}>
              Every message is saved in the in-app bell and appears the next time that person opens HeyMaa,
              including on a phone browser. A lock-screen alert is sent only to phones and browsers that have
              allowed notifications. Android Chrome can show those immediately. iPhone shows them only after
              HeyMaa is added to the Home Screen (iOS 16.4 or newer) and alerts are allowed.
            </p>
          </div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Push keys: {pushStatus?.configured ? 'ready' : 'not ready'}
          {' · '}
          Devices subscribed: {pushStatus?.devices ?? 0}
          {pushStatus?.error ? ` · ${pushStatus.error}` : ''}
        </p>
      </div>

      {setupError ? (
        <div className="card">
          <p style={{ margin: 0 }}>{setupError}</p>
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>New message</h2>
        <div className="field">
          <FieldLabel required>Title</FieldLabel>
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Short headline" />
        </div>
        <div className="field">
          <FieldLabel required>Message</FieldLabel>
          <textarea
            value={body}
            maxLength={500}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What should they see?"
          />
        </div>
        <div className="field">
          <FieldLabel>Open this page when tapped (optional)</FieldLabel>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/subscription" />
        </div>

        <div className="field">
          <FieldLabel>Who receives it</FieldLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(
              [
                ['selected', 'Specific people'],
                ['all', 'Everyone'],
                ['plan', 'By plan or status'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={audience === id ? 'teal sm' : 'sec sm'}
                onClick={() => setAudience(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {audience === 'plan' ? (
          <div className="field">
            <FieldLabel>Plan id or subscription status</FieldLabel>
            <input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="trial, active, starter, premium" />
          </div>
        ) : null}

        {audience === 'selected' ? (
          <div className="field">
            <FieldLabel>Find people</FieldLabel>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Search size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or email"
              />
            </div>
            {picked.length > 0 ? (
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
                Selected: {picked.map((u) => u.email || u.name || u.id).join(', ')}
              </p>
            ) : null}
            {hits.length > 0 ? (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {hits.map((u) => {
                  const on = pickedIds.has(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      className={on ? 'teal sm' : 'ghost sm'}
                      style={{ justifyContent: 'flex-start' }}
                      onClick={() =>
                        setPicked((cur) =>
                          on ? cur.filter((x) => x.id !== u.id) : [...cur, u],
                        )
                      }
                    >
                      {(u.name || 'No name') + ' · ' + (u.email || u.id)}
                      {u.subscription_status ? ` · ${u.subscription_status}` : ''}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="sec" onClick={() => setPreview({ title, body, url })}>
            <Eye size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            Preview
          </button>
          <button type="button" className="teal" disabled={sending} onClick={() => void send()}>
            <Send size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            {sending ? 'Sending…' : 'Send notification'}
          </button>
        </div>
      </div>

      <ComposerPreview
        open={!!preview}
        onClose={() => setPreview(null)}
        notice={preview}
      />

      <div className="card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>Sent messages</h2>
          <button type="button" className="sec sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        {history.length === 0 ? (
          <p className="muted">{loading ? 'Loading…' : 'Nothing sent yet.'}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map((item) => (
              <article key={item.id} style={{ borderTop: '.5px solid var(--border)', paddingTop: 10 }}>
                <strong>{item.title}</strong>
                <button
                  type="button"
                  className="ghost sm"
                  style={{ marginLeft: 8 }}
                  onClick={() =>
                    setPreview({
                      title: item.title || '',
                      body: item.body || '',
                      url: item.url || '',
                    })
                  }
                >
                  Preview
                </button>
                <p style={{ margin: '4px 0' }}>{item.body}</p>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  {fmt(item.created_at)} · {item.audience_label || item.audience} ·{' '}
                  {item.recipient_count ?? 0} in the bell · {item.read_count ?? 0} opened · push{' '}
                  {item.push_delivered ?? 0}/{item.push_attempted ?? 0}
                  {item.push_failed ? ` · ${item.push_failed} push failed` : ''}
                  {item.url ? ` · opens ${item.url}` : ''}
                </p>
                {item.last_error ? (
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>{item.last_error}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
