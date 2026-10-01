import { useEffect, useRef, useState } from 'react'
import { BarChart3, Download, Eye, ImagePlus, Link2, Mail, RefreshCw, Send, Trash2 } from 'lucide-react'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { ComposerPreview } from '../components/ComposerPreview'
import { CampaignReportModal } from '../components/CampaignReportModal'
import { PeoplePicker, type PickerUser } from '../components/PeoplePicker'
import { EmailAiAssist, EmailBodyEditor } from '../components/EmailBodyEditor'
import { useAdmin } from '../context/AdminContext'
import { consumeComposeDraft, giftCodeIsOfferable } from '../lib/composeDraft'
import { downloadTextFile, reportToCsv } from '../lib/downloadReport'

type Campaign = {
  id: string
  subject: string
  body: string
  url?: string | null
  button_label?: string | null
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

type PreviewState = {
  subject: string
  body: string
  url: string
  buttonLabel: string
  includeButton: boolean
  images: string[]
}

const BUTTON_PRESETS = [
  { label: 'Open HeyMaa', url: '/app', hint: 'Main app' },
  { label: 'View plans', url: '/subscription', hint: 'Pricing' },
  { label: 'Upgrade now', url: '/checkout', hint: 'Checkout' },
  { label: 'Open app (level gift)', url: '/app', hint: 'Pending level gifts claim in-app — prefer a gift code CTA below when you have one' },
]

type CtaSource = {
  id: string
  kind: 'invite' | 'offer' | 'level_gift' | 'gift'
  label: string
  url: string
  detail: string
}

function fmt(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function statusBadge(status?: string) {
  const s = (status || 'sent').toLowerCase()
  const cls =
    s === 'sent' || s === 'delivered'
      ? 'badge-ok'
      : s === 'sending'
        ? 'badge-warn'
        : s === 'failed'
          ? 'badge-err'
          : 'badge-muted'
  return <span className={`badge ${cls}`}>{s}</span>
}

function deliverySummary(item: Campaign) {
  const delivered = item.delivered ?? 0
  const total = item.recipient_count ?? 0
  const parts = [`${delivered}/${total}`]
  if (item.failed) parts.push(`${item.failed} failed`)
  if (item.skipped) parts.push(`${item.skipped} skipped`)
  return parts.join(' · ')
}

export function EmailsTab() {
  const { adminFetch, uploadImage } = useAdmin()
  const { show, Message } = useFlashMessage()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [includeButton, setIncludeButton] = useState(false)
  const [url, setUrl] = useState('/app')
  const [buttonLabel, setButtonLabel] = useState('Open HeyMaa')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [audience, setAudience] = useState<'selected' | 'all' | 'plan'>('selected')
  const [plan, setPlan] = useState('trial')
  const [picked, setPicked] = useState<PickerUser[]>([])
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<Campaign[]>([])
  const [setupError, setSetupError] = useState('')
  const [mailStatus, setMailStatus] = useState<MailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [reportPath, setReportPath] = useState<string | null>(null)
  const [reportHeading, setReportHeading] = useState('Campaign report')
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [txDays, setTxDays] = useState(30)
  const [txKind, setTxKind] = useState('')
  const [txKinds, setTxKinds] = useState<Array<{ id: string; label: string }>>([
    { id: '', label: 'All system emails' },
    { id: 'welcome_trial', label: 'Welcome (trial)' },
    { id: 'subscription_welcome', label: 'Subscription welcome' },
    { id: 'subscription_activated', label: 'Subscription activated' },
    { id: 'access_expiry_reminder', label: 'Access expiry reminder' },
    { id: 'level_gift_won', label: 'Level gift won' },
    { id: 'level_gift_activated', label: 'Level gift activated' },
    { id: 'gift_code_claimed', label: 'Gift code claimed' },
    { id: 'password_reset', label: 'Password reset' },
    { id: 'password_changed', label: 'Password changed' },
    { id: 'cancellation_confirmed', label: 'Cancellation confirmed' },
    { id: 'cancel_request_admin', label: 'Cancel request (admin alert)' },
    { id: 'support_received', label: 'Support received (user)' },
    { id: 'support_admin_alert', label: 'Support alert (admin)' },
    { id: 'support_admin_reply', label: 'Support reply (to user)' },
    { id: 'beta_invite', label: 'Beta / tester invite' },
    { id: 'transactional', label: 'Other / untagged' },
  ])
  const [aiOpen, setAiOpen] = useState(false)
  const [aiBrief, setAiBrief] = useState('')
  const [aiTone, setAiTone] = useState('warm')
  const [aiLang, setAiLang] = useState('en')
  const [aiBusy, setAiBusy] = useState(false)
  const [ctaSources, setCtaSources] = useState<CtaSource[]>([])
  const [ctaSourcesLoading, setCtaSourcesLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const stillSending = history.some((item) => item.status === 'sending')

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
          label: 'Claim your gift',
          url: `/app/auth?gift=${encodeURIComponent(code)}`,
          detail: row.label ? `${code} · ${row.label} · ${bits.join(' · ')}` : `${code} · ${bits.join(' · ')}`,
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
        const title = String(row.title || 'Offer').trim() || 'Offer'
        next.push({
          id: `offer:${row.id || link}`,
          kind: 'offer',
          label: title.length > 42 ? `${title.slice(0, 40)}…` : title,
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
          label: 'Claim your gift',
          url: '/app',
          detail: `${name}: ${days} days free ${slot} (opens app — claim sheet if pending)`,
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
    void adminFetch('/admin/emails/reports/kinds')
      .then((d) => {
        const kinds = (d.kinds as Array<{ id: string; label: string }>) || []
        if (kinds.length) setTxKinds(kinds)
      })
      .catch(() => undefined)

    const draft = consumeComposeDraft('email')
    if (draft) {
      if (draft.subject) setSubject(draft.subject)
      if (draft.body) setBody(draft.body)
      if (draft.url) setUrl(draft.url)
      if (draft.buttonLabel) setButtonLabel(draft.buttonLabel)
      if (draft.includeButton) setIncludeButton(true)
      show('Gift draft loaded — pick recipients and send when ready', 'ok')
      void loadCtaSources()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!includeButton || ctaSources.length > 0 || ctaSourcesLoading) return
    void loadCtaSources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeButton])

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
          url: preview.includeButton ? preview.url || undefined : undefined,
          button_label: preview.includeButton ? preview.buttonLabel || undefined : undefined,
          include_button: preview.includeButton,
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

  const draftWithAi = async () => {
    setAiBusy(true)
    try {
      const d = await adminFetch('/admin/emails/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: aiBrief.trim(),
          tone: aiTone,
          lang: aiLang,
          existing_subject: subject.trim() || undefined,
          existing_body: body.trim() || undefined,
          want_button: true,
        }),
      })
      if (d.subject) setSubject(String(d.subject))
      if (d.body) setBody(String(d.body))
      const suggestedUrl = String(d.url_suggestion || '').trim()
      const suggestedLabel = String(d.button_label || '').trim()
      if (suggestedUrl || suggestedLabel) {
        setIncludeButton(true)
        if (suggestedUrl) setUrl(suggestedUrl)
        if (suggestedLabel) setButtonLabel(suggestedLabel)
      }
      show('Draft ready — edit anything, then Preview before sending', 'ok')
    } catch (e) {
      show(e instanceof Error ? e.message : 'AI draft failed', 'err')
    } finally {
      setAiBusy(false)
    }
  }

  const downloadCampaignReport = async (item: Campaign) => {
    setDownloadingId(item.id)
    try {
      const d = await adminFetch(`/admin/emails/${item.id}/report`)
      const report = (d.report || {}) as Parameters<typeof reportToCsv>[0]
      const stamp = (item.created_at || new Date().toISOString()).slice(0, 10)
      const safe = (item.subject || 'email').replace(/[^\w\-]+/g, '_').slice(0, 40)
      downloadTextFile(`heymaa-email-report-${safe}-${stamp}.csv`, reportToCsv(report))
      show('Report downloaded', 'ok')
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not download report', 'err')
    } finally {
      setDownloadingId(null)
    }
  }

  const removeCampaign = async () => {
    if (!deleteTarget?.id) return
    setDeleting(true)
    try {
      await adminFetch(`/admin/emails/${deleteTarget.id}`, { method: 'DELETE' })
      show('Email removed from history', 'ok')
      setDeleteTarget(null)
      await load()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Delete failed', 'err')
    } finally {
      setDeleting(false)
    }
  }

  const send = async () => {
    if (audience === 'selected' && picked.length === 0) {
      show('Pick at least one person, or choose another audience', 'err')
      return
    }
    if (includeButton && !url.trim()) {
      show('Add a button link, or turn the button off', 'err')
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
          url: includeButton ? url.trim() || undefined : undefined,
          button_label: includeButton ? buttonLabel.trim() || undefined : undefined,
          include_button: includeButton,
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
      setIncludeButton(false)
      setUrl('/app')
      setButtonLabel('Open HeyMaa')
      setImages([])
      setPicked([])
      setAiBrief('')
      await load()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Send failed', 'err')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="broadcast-stack">
      {Message}
      <div className="card broadcast-intro">
        <div className="card-head">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Mail size={18} />
            How email works
          </h2>
        </div>
        <p className="card-desc">
          The message arrives in the person’s inbox, even if they never opened HeyMaa and never allowed
          phone alerts. It does not appear on the lock screen. Accounts without an email address are skipped.
          One send is limited to {mailStatus?.max_per_send ?? 150} people.
        </p>
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

      <div className="card broadcast-composer">
        <div className="broadcast-composer__head">
          <div>
            <h2>New email</h2>
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
        />

        <div className="field-wrap">
          <div className="email-subject-head">
            <FieldLabel required>Subject</FieldLabel>
            <span className={`email-subject-count${subject.length > 60 ? ' is-long' : ''}`}>
              {subject.length}/140
            </span>
          </div>
          <input
            value={subject}
            maxLength={140}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short subject — clear and specific"
          />
          <div className="email-subject-meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (subject.length / 60) * 100)}%` }} />
          </div>
          <p className="field-hint">Best under ~60 characters so it doesn’t truncate on phones.</p>
        </div>

        <div className="field-wrap">
          <FieldLabel required>Message</FieldLabel>
          <EmailBodyEditor
            value={body}
            onChange={setBody}
            placeholder="Write the email. Use the toolbar for bold, lists, and {name}."
          />
        </div>

        <div className={`email-cta-card${includeButton ? ' is-on' : ''}`}>
          <div className="email-cta-card__head">
            <div>
              <strong>Call-to-action button</strong>
              <p>
                Links into what already exists: app, plans, checkout, gift codes, invite codes, and offer links.
              </p>
            </div>
            <button
              type="button"
              className={`email-switch${includeButton ? ' is-on' : ''}`}
              role="switch"
              aria-checked={includeButton}
              onClick={() => setIncludeButton((v) => !v)}
            >
              <span className="email-switch__knob" />
              <span className="email-switch__label">{includeButton ? 'On' : 'Off'}</span>
            </button>
          </div>
          {includeButton ? (
            <div className="email-cta-card__body">
              <div className="email-cta-grid">
                <div className="field-wrap">
                  <FieldLabel>Button label</FieldLabel>
                  <input
                    value={buttonLabel}
                    maxLength={48}
                    onChange={(e) => setButtonLabel(e.target.value)}
                    placeholder="Open HeyMaa"
                  />
                </div>
                <div className="field-wrap">
                  <FieldLabel>Button link</FieldLabel>
                  <div className="email-cta-link">
                    <Link2 size={14} aria-hidden="true" />
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="/subscription or https://…"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="email-cta-section-label">Quick links</p>
                <div className="email-cta-presets" role="group" aria-label="Button presets">
                  {BUTTON_PRESETS.map((preset) => {
                    const active = buttonLabel === preset.label && url === preset.url
                    return (
                      <button
                        key={`${preset.label}-${preset.url}`}
                        type="button"
                        title={preset.hint}
                        className={`email-cta-preset${active ? ' is-active' : ''}`}
                        onClick={() => {
                          setButtonLabel(preset.label)
                          setUrl(preset.url)
                        }}
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
                    disabled={ctaSourcesLoading}
                    onClick={() => void loadCtaSources()}
                  >
                    {ctaSourcesLoading ? 'Loading…' : 'Refresh'}
                  </button>
                </div>
                {ctaSourcesLoading && ctaSources.length === 0 ? (
                  <p className="field-hint">Loading gift codes, invites, offers, and level gifts…</p>
                ) : ctaSources.length === 0 ? (
                  <p className="field-hint">
                    No gift codes, invite codes, or offer links found. Create gifts under Gifts, or use Invite Codes / Offers & Promos.
                  </p>
                ) : (
                  <div className="email-cta-sources">
                    {ctaSources.map((src) => {
                      const active = buttonLabel === src.label && url === src.url
                      return (
                        <button
                          key={src.id}
                          type="button"
                          className={`email-cta-source${active ? ' is-active' : ''}`}
                          onClick={() => {
                            setButtonLabel(src.label)
                            setUrl(src.url)
                            if (src.kind === 'level_gift') {
                              show('Level gifts claim in-app after opening HeyMaa — use for people with a pending reward', 'ok')
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
                <span className="email-cta-preview__label">Looks like</span>
                <span className="email-cta-preview__btn">{buttonLabel.trim() || 'Open HeyMaa'}</span>
                <span className="email-cta-preview__url">{url.trim() || '/app'}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="field-wrap">
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
          <div>
            <button
              type="button"
              className="sec sm"
              disabled={uploading || images.length >= 4}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              {uploading ? 'Uploading…' : 'Add a picture'}
            </button>
            <p className="field-hint" style={{ marginTop: 6 }}>
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
        </div>

        <div className="field-wrap">
          <FieldLabel>Who receives it</FieldLabel>
          <div className="audience-toggle">
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
                subject,
                body,
                url,
                buttonLabel,
                includeButton,
                images,
              })
            }
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

      <div className="card broadcast-report-card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>Transactional email report</h2>
        </div>
        <p className="card-desc">
          System mail (welcome, reminders, gifts, cancellations, support…). Filter by period and email type.
        </p>
        <div className="report-actions">
          <label>
            Last
            <select value={txDays} onChange={(e) => setTxDays(Number(e.target.value))}>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <label>
            Type
            <select
              value={txKind}
              onChange={(e) => setTxKind(e.target.value)}
              style={{ minWidth: 200 }}
            >
              {txKinds.map((k) => (
                <option key={k.id || 'all'} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="sec"
            onClick={() => {
              const kindLabel = txKinds.find((k) => k.id === txKind)?.label
              setReportHeading(
                txKind
                  ? `Transactional · ${kindLabel || txKind}`
                  : 'Transactional email report',
              )
              const qs = new URLSearchParams({ days: String(txDays) })
              if (txKind) qs.set('kind', txKind)
              setReportPath(`/admin/emails/reports/transactional?${qs.toString()}`)
            }}
          >
            <BarChart3 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            Open report
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>Sent emails</h2>
          <button type="button" className="sec sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <p className="card-desc" style={{ marginTop: 0 }}>
          Last 10 campaigns. Preview the message, download the analytics report, or remove a row from history
          (does not unsend mail already delivered).
        </p>
        {history.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{loading ? 'Loading…' : 'Nothing sent yet.'}</p>
        ) : (
          <div className="sent-mail-grid">
            {history.slice(0, 10).map((item) => (
              <article key={item.id} className="sent-mail-card">
                <div className="sent-mail-card__top">
                  <time className="sent-mail-card__date">{fmt(item.created_at)}</time>
                  {statusBadge(item.status)}
                </div>
                <h3 className="sent-mail-card__subject">{item.subject || '—'}</h3>
                <dl className="sent-mail-card__meta">
                  <div>
                    <dt>Audience</dt>
                    <dd>{item.audience_label || item.audience || '—'}</dd>
                  </div>
                  <div>
                    <dt>Delivery</dt>
                    <dd>{deliverySummary(item)}</dd>
                  </div>
                  {item.url ? (
                    <div>
                      <dt>CTA</dt>
                      <dd className="sent-mail-card__cta">{item.url}</dd>
                    </div>
                  ) : null}
                </dl>
                {item.last_error ? <p className="sent-mail-card__error">{item.last_error}</p> : null}
                <div className="sent-mail-card__actions">
                  <button
                    type="button"
                    className="sec sm"
                    onClick={() =>
                      setPreview({
                        subject: item.subject || '',
                        body: item.body || '',
                        url: item.url || '',
                        buttonLabel: item.button_label || 'Open HeyMaa',
                        includeButton: !!item.url,
                        images: Array.isArray(item.images)
                          ? item.images.filter((src) => typeof src === 'string')
                          : [],
                      })
                    }
                  >
                    <Eye size={14} /> Preview
                  </button>
                  <button
                    type="button"
                    className="sec sm"
                    disabled={downloadingId === item.id}
                    onClick={() => void downloadCampaignReport(item)}
                  >
                    <Download size={14} />
                    {downloadingId === item.id ? 'Downloading…' : 'Download report'}
                  </button>
                  <button
                    type="button"
                    className="sec sm"
                    onClick={() => {
                      setReportHeading(item.subject || 'Campaign report')
                      setReportPath(`/admin/emails/${item.id}/report`)
                    }}
                  >
                    <BarChart3 size={14} /> Open report
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
              </article>
            ))}
          </div>
        )}
      </div>

      {deleteTarget ? (
        <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Remove from history?</h2>
              <button type="button" className="icon-btn" onClick={() => setDeleteTarget(null)} aria-label="Close" disabled={deleting}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginTop: 0 }}>
                Remove <strong>{deleteTarget.subject || 'this email'}</strong> from the sent list?
                Recipients already received it — this only clears the admin history row.
              </p>
              <div className="composer-actions">
                <button type="button" className="sec" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                  Cancel
                </button>
                <button type="button" className="teal" disabled={deleting} onClick={() => void removeCampaign()}>
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
