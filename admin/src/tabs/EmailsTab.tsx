import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, ImagePlus, Mail, RefreshCw, Search, Send } from 'lucide-react'
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
  subject: string
  body: string
  url?: string | null
  images?: string[] | null
  audience?: string
  audience_label?: string
  status?: string
  recipient_count?: number
  delivered?: number
  failed?: number
  skipped?: number
  last_error?: string | null
  created_at?: string
}

type MailStatus = {
  configured?: boolean
  from?: string | null
  max_per_send?: number
}

function fmt(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

export function EmailsTab() {
  const { adminFetch, uploadImage } = useAdmin()
  const { show, Message } = useFlashMessage()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [audience, setAudience] = useState<'selected' | 'all' | 'plan'>('selected')
  const [plan, setPlan] = useState('trial')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<UserHit[]>([])
  const [picked, setPicked] = useState<UserHit[]>([])
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<Campaign[]>([])
  const [setupError, setSetupError] = useState('')
  const [mailStatus, setMailStatus] = useState<MailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<{ subject: string; body: string; url: string; images: string[] } | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pickedIds = useMemo(() => new Set(picked.map((u) => u.id)), [picked])
  const stillSending = history.some((item) => item.status === 'sending')

  const load = async () => {
    setLoading(true)
    try {
      const [list, status] = await Promise.all([
        adminFetch('/admin/emails'),
        adminFetch('/admin/emails/status').catch(() => null),
      ])
      setHistory((list.emails as Campaign[]) || [])
      setSetupError(list.error ? String(list.error) : '')
      if (status) setMailStatus(status as MailStatus)
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not load emails', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!stillSending) return
    const handle = window.setInterval(() => {
      void adminFetch('/admin/emails')
        .then((d) => setHistory((d.emails as Campaign[]) || []))
        .catch(() => undefined)
    }, 3000)
    return () => window.clearInterval(handle)
  }, [stillSending, adminFetch])

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

  useEffect(() => {
    if (!preview) return
    setPreviewLoading(true)
    setPreviewError('')
    const handle = window.setTimeout(() => {
      void adminFetch('/admin/emails/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: preview.subject,
          body: preview.body,
          url: preview.url || undefined,
          images: preview.images,
          sample_name: 'Maria',
        }),
      })
        .then((d) => {
          setPreviewHtml(String(d.html || ''))
          setPreviewSubject(String(d.subject || preview.subject || ''))
        })
        .catch((e) => {
          setPreviewHtml('')
          setPreviewError(e instanceof Error ? e.message : 'Could not build the preview')
        })
        .finally(() => setPreviewLoading(false))
    }, 150)
    return () => window.clearTimeout(handle)
  }, [preview, adminFetch])

  const addImage = async (file: File) => {
    if (images.length >= 4) {
      show('An email can include up to 4 pictures', 'err')
      return
    }
    setUploading(true)
    try {
      const uploaded = await uploadImage('promotions', file)
      if (uploaded.url) setImages((cur) => [...cur, uploaded.url].slice(0, 4))
    } catch (e) {
      show(e instanceof Error ? e.message : 'Upload failed', 'err')
    } finally {
      setUploading(false)
    }
  }

  const send = async () => {
    if (audience === 'selected' && picked.length === 0) {
      show('Pick at least one person, or choose another audience', 'err')
      return
    }
    const who =
      audience === 'all'
        ? 'everyone who matches'
        : audience === 'plan'
          ? `people on “${plan.trim() || 'this plan'}”`
          : `${picked.length} selected ${picked.length === 1 ? 'person' : 'people'}`
    if (!window.confirm(`Send this email to ${who}?`)) return
    setSending(true)
    try {
      const d = await adminFetch('/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          url: url.trim() || undefined,
          images,
          audience,
          user_ids: picked.map((u) => u.id),
          plan: audience === 'plan' ? plan : undefined,
        }),
      })
      const note = (d.email || {}) as Campaign
      show(`Sending to ${note.recipient_count ?? 0} people. Delivery updates below.`, 'ok')
      setSubject('')
      setBody('')
      setUrl('')
      setImages([])
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
              <Mail size={18} />
              How email works
            </h2>
            <p className="card-desc" style={{ margin: '6px 0 0' }}>
              The message arrives in the person’s inbox, even if they never opened HeyMaa and never allowed
              phone alerts. It does not appear on the lock screen. Accounts without an email address are skipped.
              One send is limited to {mailStatus?.max_per_send ?? 150} people.
            </p>
          </div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Mail: {mailStatus?.configured ? 'ready' : 'not configured'}
          {mailStatus?.from ? ` · from ${mailStatus.from}` : ''}
        </p>
      </div>

      {setupError ? (
        <div className="card">
          <p style={{ margin: 0 }}>{setupError}</p>
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>New email</h2>
        <div className="field">
          <FieldLabel required>Subject</FieldLabel>
          <input value={subject} maxLength={140} onChange={(e) => setSubject(e.target.value)} placeholder="Short subject" />
        </div>
        <div className="field">
          <FieldLabel required>Message</FieldLabel>
          <textarea
            value={body}
            maxLength={4000}
            rows={6}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write the email. Use {name} if you want their name in the text."
          />
        </div>
        <div className="field">
          <FieldLabel>Button link (optional)</FieldLabel>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/subscription or https://…" />
        </div>
        <div className="field">
          <FieldLabel>Pictures (optional)</FieldLabel>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void addImage(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="sec sm"
            disabled={uploading || images.length >= 4}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            {uploading ? 'Uploading…' : 'Add a picture'}
          </button>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
            JPEG, PNG, WebP, or GIF. Up to 4. They appear in the email under the text.
          </p>
          {images.length > 0 ? (
            <div className="email-visuals">
              {images.map((src) => (
                <div className="email-visuals__item" key={src}>
                  <img src={src} alt="" />
                  <button
                    type="button"
                    className="email-visuals__remove"
                    aria-label="Remove picture"
                    onClick={() => setImages((cur) => cur.filter((item) => item !== src))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
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
                        setPicked((cur) => (on ? cur.filter((x) => x.id !== u.id) : [...cur, u]))
                      }
                    >
                      {(u.name || 'No name') + ' · ' + (u.email || 'no email')}
                      {u.subscription_status ? ` · ${u.subscription_status}` : ''}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="sec"
            onClick={() => setPreview({ subject, body, url, images })}
          >
            <Eye size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            Preview
          </button>
          <button type="button" className="teal" disabled={sending || !mailStatus?.configured} onClick={() => void send()}>
            <Send size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            {sending ? 'Sending…' : 'Send email'}
          </button>
        </div>
      </div>

      <ComposerPreview
        open={!!preview}
        onClose={() => {
          setPreview(null)
          setPreviewHtml('')
          setPreviewSubject('')
          setPreviewError('')
        }}
        mail={{
          subject: previewSubject || preview?.subject || '',
          html: previewHtml,
          loading: previewLoading,
          error: previewError,
        }}
      />

      <div className="card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>Sent emails</h2>
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
                <strong>{item.subject}</strong>
                <button
                  type="button"
                  className="ghost sm"
                  style={{ marginLeft: 8 }}
                  onClick={() =>
                    setPreview({
                      subject: item.subject || '',
                      body: item.body || '',
                      url: item.url || '',
                      images: Array.isArray(item.images) ? item.images.filter((src) => typeof src === 'string') : [],
                    })
                  }
                >
                  Preview
                </button>
                <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{item.body}</p>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  {fmt(item.created_at)} · {item.audience_label || item.audience} · {item.status || 'sent'} ·{' '}
                  delivered {item.delivered ?? 0}/{item.recipient_count ?? 0}
                  {item.failed ? ` · ${item.failed} failed` : ''}
                  {item.skipped ? ` · ${item.skipped} skipped` : ''}
                  {item.url ? ` · button ${item.url}` : ''}
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
