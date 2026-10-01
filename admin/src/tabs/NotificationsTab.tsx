import { useEffect, useState } from 'react'
import { BarChart3, Bell, Eye, RefreshCw, Send } from 'lucide-react'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { ComposerPreview } from '../components/ComposerPreview'
import { CampaignReportModal } from '../components/CampaignReportModal'
import { PeoplePicker, type PickerUser } from '../components/PeoplePicker'
import { useAdmin } from '../context/AdminContext'
import { consumeComposeDraft, giftCodeIsOfferable } from '../lib/composeDraft'

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

type Audience = 'selected' | 'all' | 'plan' | 'no_push'

type GiftCta = {
  id: string
  label: string
  url: string
  detail: string
}

const PUSH_NUDGE_TITLE = 'Stay in touch with HeyMaa'
const PUSH_NUDGE_BODY =
  'Turn on lock-screen alerts so you don’t miss important updates when the app is closed. Open Account → Privacy to activate in one tap.'

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
  const [audience, setAudience] = useState<Audience>('selected')
  const [plan, setPlan] = useState('trial')
  const [picked, setPicked] = useState<PickerUser[]>([])
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<Campaign[]>([])
  const [setupError, setSetupError] = useState('')
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<{ title: string; body: string; url: string } | null>(null)
  const [reportPath, setReportPath] = useState<string | null>(null)
  const [reportHeading, setReportHeading] = useState('Notification report')
  const [overviewDays, setOverviewDays] = useState(30)
  const [giftCtas, setGiftCtas] = useState<GiftCta[]>([])
  const [giftCtasLoading, setGiftCtasLoading] = useState(false)

  const loadGiftCtas = async () => {
    setGiftCtasLoading(true)
    try {
      const d = await adminFetch('/admin/gift_codes').catch(() => ({ gifts: [] }))
      const next: GiftCta[] = []
      for (const row of (d.gifts as Array<{
        code?: string
        status?: string
        gift_type?: string
        plan_slot?: string | null
        days?: number | null
        points?: number | null
        label?: string | null
        expires_at?: string | null
        max_claims?: number | null
        claim_count?: number | null
      }>) || []) {
        const code = String(row.code || '').trim()
        if (!code || !giftCodeIsOfferable(row)) continue
        const bits: string[] = []
        if (row.gift_type === 'free_plan_days' || row.gift_type === 'combo') {
          bits.push(`${row.days || 0}d ${row.plan_slot || 'plan'}`)
        }
        if (row.gift_type === 'bonus_points' || row.gift_type === 'combo') {
          bits.push(`+${row.points || 0} pts`)
        }
        next.push({
          id: `gift:${code}`,
          label: row.label ? String(row.label) : `Claim ${code}`,
          url: `/app?gift=${encodeURIComponent(code)}`,
          detail: bits.length ? `${code} · ${bits.join(' · ')}` : code,
        })
      }
      setGiftCtas(next)
    } finally {
      setGiftCtasLoading(false)
    }
  }

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
    void loadGiftCtas()
    const draft = consumeComposeDraft('notification')
    if (draft) {
      if (draft.title) setTitle(draft.title)
      if (draft.body) setBody(draft.body)
      if (draft.url) setUrl(draft.url)
      show('Gift draft loaded — pick recipients and send when ready', 'ok')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const fillPushNudge = () => {
    setAudience('no_push')
    setTitle(PUSH_NUDGE_TITLE)
    setBody(PUSH_NUDGE_BODY)
    setUrl('')
    show('Composer filled for users without lock-screen alerts — review and send when ready', 'ok')
  }

  return (
    <div className="broadcast-stack">
      {Message}
      <div className="card broadcast-intro">
        <div className="card-head">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Bell size={18} />
            How delivery works
          </h2>
        </div>
        <p className="card-desc">
          Every message is saved in the in-app bell and appears the next time that person opens HeyMaa,
          including on a phone browser. A lock-screen alert is sent only to phones and browsers that have
          allowed notifications. Android Chrome can show those immediately. iPhone shows them only after
          HeyMaa is added to the Home Screen (iOS 16.4 or newer) and alerts are allowed.
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Push keys: {pushStatus?.configured ? 'ready' : 'not ready'}
          {' · '}
          Devices subscribed: {pushStatus?.devices ?? 0}
          {pushStatus?.error ? ` · ${pushStatus.error}` : ''}
        </p>
      </div>

      <div className="card broadcast-report-card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>Web Push signup</h2>
        </div>
        <p className="card-desc">
          How many accounts have activated lock-screen alerts, soft-opted at signup, or still need a nudge.
          Use “Without push” below to message people who only see the in-app bell today.
        </p>
        <div className="report-actions">
          <button
            type="button"
            className="sec"
            onClick={() => {
              setReportHeading('Web Push adoption')
              setReportPath('/admin/notifications/reports/push-adoption')
            }}
          >
            <BarChart3 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            Open adoption report
          </button>
          <button type="button" className="sec" onClick={fillPushNudge}>
            Prep activation nudge
          </button>
        </div>
      </div>

      {setupError ? (
        <div className="card">
          <p style={{ margin: 0 }}>{setupError}</p>
        </div>
      ) : null}

      <div className="card broadcast-composer">
        <h2>New message</h2>
        <div className="field-wrap">
          <FieldLabel required>Title</FieldLabel>
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Short headline" />
        </div>
        <div className="field-wrap">
          <FieldLabel required>Message</FieldLabel>
          <textarea
            value={body}
            maxLength={500}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What should they see?"
          />
        </div>
        <div className="field-wrap">
          <FieldLabel>Open this page when tapped (optional)</FieldLabel>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/subscription" />
          <p className="field-hint" style={{ marginTop: 6 }}>
            Gift codes open the claim sheet via <code>/app?gift=CODE</code> — pick one below or from Gifts → compose.
          </p>
          {giftCtasLoading && giftCtas.length === 0 ? (
            <p className="field-hint">Loading gift codes…</p>
          ) : giftCtas.length > 0 ? (
            <div className="email-cta-sources" style={{ marginTop: 8 }}>
              {giftCtas.map((src) => {
                const active = url === src.url
                return (
                  <button
                    key={src.id}
                    type="button"
                    className={`email-cta-source${active ? ' is-active' : ''}`}
                    onClick={() => {
                      setUrl(src.url)
                      if (!title.trim()) setTitle(src.label.slice(0, 120))
                      if (!body.trim()) setBody(`Tap to claim: ${src.detail}`.slice(0, 500))
                    }}
                  >
                    <span className="email-cta-source__kind">Gift code</span>
                    <strong>{src.label}</strong>
                    <span>{src.detail}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="field-hint">No active gift codes yet — create one under Gifts.</p>
          )}
        </div>

        <div className="field-wrap">
          <FieldLabel>Who receives it</FieldLabel>
          <div className="audience-toggle">
            {(
              [
                ['selected', 'Specific people'],
                ['all', 'Everyone'],
                ['plan', 'By plan or status'],
                ['no_push', 'Without push'],
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
          {audience === 'no_push' ? (
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
              Targets accounts with no browser/device subscription. They still get this in the bell
              (best channel to ask them to activate lock-screen alerts).
            </p>
          ) : null}
        </div>

        {audience === 'plan' ? (
          <div className="field-wrap">
            <FieldLabel>Plan id or subscription status</FieldLabel>
            <input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="trial, active, starter, premium" />
          </div>
        ) : null}

        {audience === 'selected' ? <PeoplePicker picked={picked} onChange={setPicked} /> : null}

        <div className="composer-actions">
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

      <div className="card broadcast-report-card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>Notifications report</h2>
        </div>
        <p className="card-desc">
          Reads, push delivery and campaign totals across all in-app notifications — filter by period.
        </p>
        <div className="report-actions">
          <label>
            Last
            <select value={overviewDays} onChange={(e) => setOverviewDays(Number(e.target.value))}>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <button
            type="button"
            className="sec"
            onClick={() => {
              setReportHeading('Notifications report')
              setReportPath(`/admin/notifications/reports/overview?days=${overviewDays}`)
            }}
          >
            <BarChart3 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            Open report
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>Sent messages</h2>
          <button type="button" className="sec sm" onClick={() => void load()} aria-busy={loading || undefined}>
            <RefreshCw size={14} className={loading ? 'icon-spin' : undefined} /> Refresh
          </button>
        </div>
        {history.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{loading ? 'Loading…' : 'Nothing sent yet.'}</p>
        ) : (
          <div className="broadcast-history-list">
            {history.map((item) => (
              <article key={item.id} className="broadcast-history-item">
                <div className="broadcast-history-item__head">
                  <strong>{item.title}</strong>
                  <button
                    type="button"
                    className="ghost sm"
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
                  <button
                    type="button"
                    className="ghost sm"
                    onClick={() => {
                      setReportHeading('Notification report')
                      setReportPath(`/admin/notifications/${item.id}/report`)
                    }}
                  >
                    <BarChart3 size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
                    Report
                  </button>
                </div>
                <p>{item.body}</p>
                <p className="muted" style={{ fontSize: 12 }}>
                  {fmt(item.created_at)} · {item.audience_label || item.audience} ·{' '}
                  {item.recipient_count ?? 0} in the bell · {item.read_count ?? 0} opened · push{' '}
                  {item.push_delivered ?? 0}/{item.push_attempted ?? 0}
                  {item.push_failed ? ` · ${item.push_failed} push failed` : ''}
                  {item.url ? ` · opens ${item.url}` : ''}
                </p>
                {item.last_error ? (
                  <p className="muted" style={{ fontSize: 12 }}>{item.last_error}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>

      <CampaignReportModal
        open={!!reportPath}
        path={reportPath}
        heading={reportHeading}
        onClose={() => setReportPath(null)}
      />
    </div>
  )
}
