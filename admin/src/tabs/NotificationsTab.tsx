import { useEffect, useState } from 'react'
import { BarChart3, Bell, Download, Eye, Link2, RefreshCw, Send, Trash2 } from 'lucide-react'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { ComposerPreview } from '../components/ComposerPreview'
import { CampaignReportModal } from '../components/CampaignReportModal'
import { PeoplePicker, type PickerUser } from '../components/PeoplePicker'
import { EmailAiAssist } from '../components/EmailBodyEditor'
import { useAdmin } from '../context/AdminContext'
import { consumeComposeDraft, giftCodeIsOfferable } from '../lib/composeDraft'
import { downloadTextFile, reportToCsv } from '../lib/downloadReport'

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

type CtaSource = {
  id: string
  kind: 'invite' | 'offer' | 'level_gift' | 'gift'
  label: string
  url: string
  detail: string
}

const PUSH_NUDGE_TITLE = 'Stay in touch with HeyMaa'
const PUSH_NUDGE_BODY =
  'Turn on lock-screen alerts so you don’t miss important updates when the app is closed. Open Account → Privacy to activate in one tap.'

const TAP_PRESETS = [
  { label: 'Open HeyMaa', url: '/app', hint: 'Main app · Account → Privacy for push' },
  { label: 'View plans', url: '/subscription', hint: 'Pricing' },
  { label: 'Upgrade now', url: '/checkout', hint: 'Checkout' },
]

function fmt(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function deliverySummary(item: Campaign) {
  const recipients = item.recipient_count ?? 0
  const reads = item.read_count ?? 0
  const pushD = item.push_delivered ?? 0
  const pushA = item.push_attempted ?? 0
  const parts = [`${recipients} in bell`, `${reads} opened`, `push ${pushD}/${pushA}`]
  if (item.push_failed) parts.push(`${item.push_failed} push failed`)
  return parts.join(' · ')
}

export function NotificationsTab() {
  const { adminFetch } = useAdmin()
  const { show, Message } = useFlashMessage()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [includeUrl, setIncludeUrl] = useState(false)
  const [url, setUrl] = useState('/app')
  const [audience, setAudience] = useState<Audience>('selected')
  const [plan, setPlan] = useState('trial')
  const [picked, setPicked] = useState<PickerUser[]>([])
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<Campaign[]>([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [setupError, setSetupError] = useState('')
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<{ title: string; body: string; url: string } | null>(null)
  const [reportPath, setReportPath] = useState<string | null>(null)
  const [reportHeading, setReportHeading] = useState('Notification report')
  const [overviewDays, setOverviewDays] = useState(30)
  const [ctaSources, setCtaSources] = useState<CtaSource[]>([])
  const [ctaSourcesLoading, setCtaSourcesLoading] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiBrief, setAiBrief] = useState('')
  const [aiTone, setAiTone] = useState('warm')
  const [aiLang, setAiLang] = useState('en')
  const [aiBusy, setAiBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const loadCtaSources = async () => {
    setCtaSourcesLoading(true)
    try {
      const [invites, offers, levels, gifts] = await Promise.all([
        adminFetch('/admin/invite_codes').catch(() => ({ codes: [] })),
        adminFetch('/admin/offers').catch(() => ({ offers: [] })),
        adminFetch('/admin/levels').catch(() => ({ levels: [] })),
        adminFetch('/admin/gift_codes').catch(() => ({ gifts: [] })),
      ])
      const next: CtaSource[] = []

      for (const row of (gifts.gifts as Array<{
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
          kind: 'gift',
          label: row.label ? String(row.label) : 'Claim your gift',
          url: `/app?gift=${encodeURIComponent(code)}`,
          detail: bits.length ? `${code} · ${bits.join(' · ')}` : code,
        })
      }

      for (const row of (invites.codes as Array<{ code?: string; status?: string; label?: string }>) || []) {
        const code = String(row.code || '').trim()
        if (!code || (row.status || 'active') !== 'active') continue
        next.push({
          id: `invite:${code}`,
          kind: 'invite',
          label: 'Join with invite',
          url: `/app/auth?invite=${encodeURIComponent(code)}`,
          detail: row.label ? `${code} · ${row.label}` : code,
        })
      }

      for (const row of (offers.offers as Array<{ id?: string; title?: string; link?: string | null }>) || []) {
        const link = String(row.link || '').trim()
        if (!link) continue
        const offerTitle = String(row.title || 'Offer').trim() || 'Offer'
        next.push({
          id: `offer:${row.id || link}`,
          kind: 'offer',
          label: offerTitle.length > 42 ? `${offerTitle.slice(0, 40)}…` : offerTitle,
          url: link,
          detail: 'Offer / promo link',
        })
      }

      for (const row of (levels.levels as Array<{
        id?: string
        name_en?: string
        name_el?: string
        reward_plan_slot?: string | null
        reward_days?: number | null
      }>) || []) {
        const slot = String(row.reward_plan_slot || '').trim()
        const days = Number(row.reward_days) || 0
        if (!slot || days < 1) continue
        const name = String(row.name_en || row.name_el || row.id || 'Level').trim()
        next.push({
          id: `level:${row.id || name}`,
          kind: 'level_gift',
          label: 'Open app (level gift)',
          url: '/app',
          detail: `${name}: ${days} days free ${slot}`,
        })
      }

      setCtaSources(next)
    } finally {
      setCtaSourcesLoading(false)
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (fromDate) qs.set('from_date', fromDate)
      if (toDate) qs.set('to_date', toDate)
      qs.set('limit', fromDate || toDate ? '50' : '10')
      const path = `/admin/notifications${qs.toString() ? `?${qs.toString()}` : ''}`
      const [list, status] = await Promise.all([
        adminFetch(path),
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
  }, [fromDate, toDate])

  useEffect(() => {
    void loadCtaSources()
    const draft = consumeComposeDraft('notification')
    if (draft) {
      if (draft.title) setTitle(draft.title)
      if (draft.body) setBody(draft.body)
      if (draft.url) {
        setUrl(draft.url)
        setIncludeUrl(true)
      }
      show('Gift draft loaded — pick recipients and send when ready', 'ok')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!includeUrl || ctaSources.length > 0 || ctaSourcesLoading) return
    void loadCtaSources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeUrl])

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
          url: includeUrl ? url.trim() || undefined : undefined,
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
      setUrl('/app')
      setIncludeUrl(false)
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
    setIncludeUrl(true)
    setUrl('/app')
    show('Composer filled for users without lock-screen alerts — review and send when ready', 'ok')
  }

  const draftWithAi = async () => {
    setAiBusy(true)
    try {
      const d = await adminFetch('/admin/notifications/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: aiBrief.trim(),
          tone: aiTone,
          lang: aiLang,
          existing_title: title.trim() || undefined,
          existing_body: body.trim() || undefined,
          want_url: true,
        }),
      })
      if (d.title) setTitle(String(d.title).slice(0, 120))
      if (d.body) setBody(String(d.body).slice(0, 500))
      const suggestedUrl = String(d.url_suggestion || '').trim()
      if (suggestedUrl) {
        setIncludeUrl(true)
        setUrl(suggestedUrl)
      }
      show('Draft ready — edit anything, then Preview before sending', 'ok')
    } catch (e) {
      show(e instanceof Error ? e.message : 'AI draft failed', 'err')
    } finally {
      setAiBusy(false)
    }
  }

  const downloadNotificationReport = async (item: Campaign) => {
    setDownloadingId(item.id)
    try {
      const d = await adminFetch(`/admin/notifications/${item.id}/report`)
      const report = (d.report || {}) as Parameters<typeof reportToCsv>[0]
      const stamp = (item.created_at || new Date().toISOString()).slice(0, 10)
      const safe = (item.title || 'notification').replace(/[^\w\-]+/g, '_').slice(0, 40)
      downloadTextFile(`heymaa-notification-report-${safe}-${stamp}.csv`, reportToCsv(report))
      show('Report downloaded', 'ok')
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not download report', 'err')
    } finally {
      setDownloadingId(null)
    }
  }

  const removeNotification = async () => {
    if (!deleteTarget?.id) return
    setDeleting(true)
    try {
      await adminFetch(`/admin/notifications/${deleteTarget.id}`, { method: 'DELETE' })
      show('Notification removed from history', 'ok')
      setDeleteTarget(null)
      await load()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Delete failed', 'err')
    } finally {
      setDeleting(false)
    }
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
        <div className="broadcast-composer__head">
          <div>
            <h2>New message</h2>
            <p className="broadcast-composer__sub">Write freely, or let AI start a draft you can refine.</p>
          </div>
        </div>

        <EmailAiAssist
          open={aiOpen}
          onToggle={() => setAiOpen((v) => !v)}
          brief={aiBrief}
          onBriefChange={setAiBrief}
          tone={aiTone}
          onToneChange={setAiTone}
          lang={aiLang}
          onLangChange={setAiLang}
          busy={aiBusy}
          onDraft={() => void draftWithAi()}
          description="Optional — draft title, message, and tap link from a short brief."
          briefLabel="What should this notification say?"
          briefPlaceholder="e.g. Nudge moms without push to turn on lock-screen alerts in Account → Privacy"
          briefId="notif-ai-brief"
        />

        <div className="field-wrap">
          <div className="email-subject-head">
            <FieldLabel required>Title</FieldLabel>
            <span className={`email-subject-count${title.length > 50 ? ' is-long' : ''}`}>
              {title.length}/120
            </span>
          </div>
          <input
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short headline — clear and specific"
          />
          <div className="email-subject-meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (title.length / 50) * 100)}%` }} />
          </div>
          <p className="field-hint">Best under ~50 characters so it doesn’t truncate on lock screens.</p>
        </div>

        <div className="field-wrap">
          <div className="email-subject-head">
            <FieldLabel required>Message</FieldLabel>
            <span className={`email-subject-count${body.length > 180 ? ' is-long' : ''}`}>
              {body.length}/500
            </span>
          </div>
          <textarea
            value={body}
            maxLength={500}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What should they see in the bell and on the lock screen?"
          />
          <div className="email-subject-meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (body.length / 180) * 100)}%` }} />
          </div>
          <p className="field-hint">Aim for ≤180 characters for push preview; longer text still shows in the bell.</p>
        </div>

        <div className={`email-cta-card${includeUrl ? ' is-on' : ''}`}>
          <div className="email-cta-card__head">
            <div>
              <strong>Tap destination</strong>
              <p>
                Optional deep link when they tap the bell item or push alert — gifts, plans, checkout, invites,
                offers.
              </p>
            </div>
            <button
              type="button"
              className={`email-switch${includeUrl ? ' is-on' : ''}`}
              role="switch"
              aria-checked={includeUrl}
              onClick={() => setIncludeUrl((v) => !v)}
            >
              <span className="email-switch__knob" />
              <span className="email-switch__label">{includeUrl ? 'On' : 'Off'}</span>
            </button>
          </div>
          {includeUrl ? (
            <div className="email-cta-card__body">
              <div className="field-wrap">
                <FieldLabel>Open this page when tapped</FieldLabel>
                <div className="email-cta-link">
                  <Link2 size={14} aria-hidden="true" />
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="/subscription or https://…"
                  />
                </div>
                <p className="field-hint" style={{ marginTop: 6 }}>
                  Gift codes open the claim sheet via <code>/app?gift=CODE</code>.
                </p>
              </div>

              <div>
                <p className="email-cta-section-label">Quick links</p>
                <div className="email-cta-presets" role="group" aria-label="Tap destination presets">
                  {TAP_PRESETS.map((preset) => {
                    const active = url === preset.url
                    return (
                      <button
                        key={`${preset.label}-${preset.url}`}
                        type="button"
                        title={preset.hint}
                        className={`email-cta-preset${active ? ' is-active' : ''}`}
                        onClick={() => setUrl(preset.url)}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="email-cta-section-head">
                  <p className="email-cta-section-label">From your product</p>
                  <button
                    type="button"
                    className="ghost sm"
                    onClick={() => void loadCtaSources()}
                    aria-busy={ctaSourcesLoading || undefined}
                  >
                    <RefreshCw
                      size={12}
                      className={ctaSourcesLoading ? 'icon-spin' : undefined}
                      style={{ verticalAlign: -2, marginRight: 4 }}
                    />
                    Refresh
                  </button>
                </div>
                {ctaSourcesLoading && ctaSources.length === 0 ? (
                  <p className="field-hint">Loading gift codes, invites, offers, and level gifts…</p>
                ) : ctaSources.length === 0 ? (
                  <p className="field-hint">
                    No gift codes, invite codes, or offer links found. Create gifts under Gifts, or use Invite
                    Codes / Offers & Promos.
                  </p>
                ) : (
                  <div className="email-cta-sources">
                    {ctaSources.map((src) => {
                      const active = url === src.url
                      return (
                        <button
                          key={src.id}
                          type="button"
                          className={`email-cta-source${active ? ' is-active' : ''}`}
                          onClick={() => {
                            setUrl(src.url)
                            if (src.kind === 'gift' && !title.trim()) setTitle(src.label.slice(0, 120))
                            if (src.kind === 'level_gift') {
                              show(
                                'Level gifts claim in-app after opening HeyMaa — use for people with a pending reward',
                                'ok',
                              )
                            }
                          }}
                        >
                          <span className="email-cta-source__kind">
                            {src.kind === 'invite'
                              ? 'Invite'
                              : src.kind === 'offer'
                                ? 'Offer'
                                : src.kind === 'gift'
                                  ? 'Gift code'
                                  : 'Level gift'}
                          </span>
                          <strong>{src.label}</strong>
                          <span>{src.detail}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="email-cta-preview">
                <span className="email-cta-preview__label">Opens</span>
                <span className="email-cta-preview__url">{url.trim() || '/app'}</span>
              </div>
            </div>
          ) : null}
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
          <button
            type="button"
            className="sec"
            onClick={() =>
              setPreview({
                title,
                body,
                url: includeUrl ? url : '',
              })
            }
          >
            <Eye size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            Preview
          </button>
          <button type="button" className="teal" disabled={sending} onClick={() => void send()}>
            <Send size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            {sending ? 'Sending…' : 'Send notification'}
          </button>
        </div>
      </div>

      <ComposerPreview open={!!preview} onClose={() => setPreview(null)} notice={preview} />

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
        <p className="card-desc" style={{ marginTop: 0 }}>
          {fromDate || toDate
            ? 'Notifications in the selected date range (up to 50).'
            : 'Last 10 notifications.'}{' '}
          Preview, download the report, open analytics, or remove a history row (does not unsend messages
          already delivered).
        </p>
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="field-wrap">
            <FieldLabel>From</FieldLabel>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="field-wrap">
            <FieldLabel>To</FieldLabel>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          {fromDate || toDate ? (
            <div className="field-wrap" style={{ flex: '0 0 auto', justifyContent: 'flex-end' }}>
              <FieldLabel>&nbsp;</FieldLabel>
              <button
                type="button"
                className="ghost sm"
                onClick={() => {
                  setFromDate('')
                  setToDate('')
                }}
              >
                Clear dates
              </button>
            </div>
          ) : null}
        </div>
        {history.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{loading ? 'Loading…' : 'Nothing sent yet.'}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table sent-mail-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Title</th>
                  <th>Audience</th>
                  <th>Delivery</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="sent-mail-table__when">{fmt(item.created_at)}</td>
                    <td>
                      <strong>{item.title || '—'}</strong>
                      {item.url ? <div className="muted sent-mail-table__cta">{item.url}</div> : null}
                      {item.last_error ? (
                        <div className="sent-mail-table__error" title={item.last_error}>
                          {item.last_error}
                        </div>
                      ) : null}
                    </td>
                    <td>{item.audience_label || item.audience || '—'}</td>
                    <td>{deliverySummary(item)}</td>
                    <td>
                      <div className="sent-mail-table__actions">
                        <button
                          type="button"
                          className="sec sm"
                          onClick={() =>
                            setPreview({
                              title: item.title || '',
                              body: item.body || '',
                              url: item.url || '',
                            })
                          }
                        >
                          <Eye size={14} /> Preview
                        </button>
                        <button
                          type="button"
                          className="sec sm"
                          disabled={downloadingId === item.id}
                          onClick={() => void downloadNotificationReport(item)}
                        >
                          <Download size={14} />
                          {downloadingId === item.id ? '…' : 'Download'}
                        </button>
                        <button
                          type="button"
                          className="sec sm"
                          onClick={() => {
                            setReportHeading(item.title || 'Notification report')
                            setReportPath(`/admin/notifications/${item.id}/report`)
                          }}
                        >
                          <BarChart3 size={14} /> Report
                        </button>
                        <button
                          type="button"
                          className="ghost sm"
                          title="Remove from history"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget ? (
        <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Remove from history?</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setDeleteTarget(null)}
                aria-label="Close"
                disabled={deleting}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginTop: 0 }}>
                Remove <strong>{deleteTarget.title || 'this notification'}</strong> from the sent list?
                Recipients may already have seen it — this only clears the admin history row.
              </p>
              <div className="composer-actions">
                <button type="button" className="sec" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                  Cancel
                </button>
                <button type="button" className="teal" disabled={deleting} onClick={() => void removeNotification()}>
                  {deleting ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <CampaignReportModal
        open={!!reportPath}
        path={reportPath}
        heading={reportHeading}
        onClose={() => setReportPath(null)}
      />
    </div>
  )
}
