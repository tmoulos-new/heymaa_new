import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  Save,
  Sprout,
  Trash2,
  Play,
  X,
  Users,
  Mail,
  Bell,
  Workflow,
} from 'lucide-react'
import { FieldLabel, FormLockBody, FormLockControls, useFlashMessage } from '../components/ui'
import { EmailBodyEditor } from '../components/EmailBodyEditor'
import { PeoplePicker, type PickerUser } from '../components/PeoplePicker'
import { MultiSelectSearch } from '../components/MultiSelectSearch'
import { useAdmin } from '../context/AdminContext'
import { LANG_OPTIONS } from '../lib/constants'

type Step = {
  id?: string
  step_index: number
  anchor: 'enrolled_at' | 'trial_ends_at'
  offset_hours: number
  channel: 'email' | 'notification' | 'both'
  email_subject?: string | null
  email_body?: string | null
  email_url?: string | null
  email_button_label?: string | null
  email_images?: string[]
  notif_title?: string | null
  notif_body?: string | null
  notif_url?: string | null
  gift_code?: string | null
  enabled?: boolean
}

type Sequence = {
  id: string
  name: string
  description?: string | null
  status: 'draft' | 'active' | 'paused' | 'archived'
  trigger_type: string
  langs: string[]
  require_marketing_consent: boolean
  min_hours_between_emails: number
  min_hours_between_push: number
  exit_on_paid: boolean
  exit_on_gift_claim: boolean
  steps?: Step[]
  step_count?: number
  active_enrollments?: number
  updated_at?: string
}

type GiftOpt = { code: string; label?: string | null; status?: string }

type SendRow = {
  id: string
  channel: string
  status: string
  subject_or_title?: string
  sent_at?: string
  last_error?: string | null
  user_id?: string
}

type EnrollRow = {
  id: string
  user_id: string
  status: string
  enrolled_at?: string
  next_step_index?: number
  next_run_at?: string
  exited_reason?: string | null
}

function fmt(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function emptyStep(index: number): Step {
  return {
    step_index: index,
    anchor: 'enrolled_at',
    offset_hours: 72,
    channel: 'both',
    email_subject: '',
    email_body: '',
    email_url: '/subscription',
    email_button_label: 'View plans',
    email_images: [],
    notif_title: '',
    notif_body: '',
    notif_url: '/subscription',
    gift_code: '',
    enabled: true,
  }
}

function statusBadge(status?: string) {
  const s = (status || 'draft').toLowerCase()
  const cls =
    s === 'active'
      ? 'badge-ok'
      : s === 'paused' || s === 'draft'
        ? 'badge-warn'
        : 'badge-muted'
  return <span className={`badge ${cls}`}>{s}</span>
}

function timingLabel(step: Step) {
  const h = Number(step.offset_hours) || 0
  const abs = Math.abs(h)
  const days = abs >= 24 ? `${(abs / 24).toFixed(abs % 24 === 0 ? 0 : 1)}d` : `${abs}h`
  if (step.anchor === 'trial_ends_at') {
    return h < 0 ? `${days} before trial end` : h === 0 ? 'at trial end' : `${days} after trial end`
  }
  return h === 0 ? 'at enrollment' : `${days} after enrollment`
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function DripsTab() {
  const { adminFetch } = useAdmin()
  const { show, Message } = useFlashMessage()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState('')
  const [statusNote, setStatusNote] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const [draft, setDraft] = useState<Sequence | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openStep, setOpenStep] = useState<number | null>(0)

  const [gifts, setGifts] = useState<GiftOpt[]>([])
  const [sends, setSends] = useState<SendRow[]>([])
  const [enrollments, setEnrollments] = useState<EnrollRow[]>([])
  const [picked, setPicked] = useState<PickerUser[]>([])
  const [enrolling, setEnrolling] = useState(false)
  const [running, setRunning] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLangs, setNewLangs] = useState<string[]>(['el'])
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Sequence | null>(null)
  const [deleting, setDeleting] = useState(false)

  const langOptions = LANG_OPTIONS.map((l) => ({ value: l.value, label: l.label }))

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const [st, list, giftRes] = await Promise.all([
        adminFetch('/admin/drips/status').catch(() => ({ ok: false, error: 'status failed' })),
        adminFetch('/admin/drips'),
        adminFetch('/admin/gift_codes').catch(() => ({ gifts: [] })),
      ])
      const status = st as {
        ok?: boolean
        error?: string
        caps?: { note?: string }
      }
      if (!status.ok && status.error) setSetupError(String(status.error))
      else setSetupError('')
      if (status.caps?.note) setStatusNote(String(status.caps.note))
      const rows = (list.sequences as Sequence[]) || []
      setSequences(rows)
      const offerable = ((giftRes.gifts as GiftOpt[]) || []).filter(
        (g) => (g.status || 'active') === 'active',
      )
      setGifts(offerable)
      if (!selectedIdRef.current && rows[0]) {
        selectedIdRef.current = rows[0].id
        setSelectedId(rows[0].id)
      }
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : 'Could not load drips')
      setSequences([])
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        const [detail, sendRes, enrollRes] = await Promise.all([
          adminFetch(`/admin/drips/${encodeURIComponent(id)}`),
          adminFetch(`/admin/drips/${encodeURIComponent(id)}/sends?limit=40`),
          adminFetch(`/admin/drips/${encodeURIComponent(id)}/enrollments?limit=40`),
        ])
        const seq = detail.sequence as Sequence
        setDraft({
          ...seq,
          steps: (seq.steps || []).map((s, i) => ({
            ...emptyStep(i),
            ...s,
            email_images: Array.isArray(s.email_images) ? s.email_images : [],
          })),
        })
        setSends((sendRes.sends as SendRow[]) || [])
        setEnrollments((enrollRes.enrollments as EnrollRow[]) || [])
        setEditing(false)
        setOpenStep(0)
      } catch (e) {
        show(e instanceof Error ? e.message : 'Could not load sequence', 'err')
      }
    },
    [adminFetch, show],
  )

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    selectedIdRef.current = selectedId
    if (selectedId) void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const selectSequence = (id: string) => {
    selectedIdRef.current = id
    setSelectedId(id)
  }

  const patchDraft = (partial: Partial<Sequence>) => {
    setDraft((d) => (d ? { ...d, ...partial } : d))
  }

  const patchStep = (index: number, partial: Partial<Step>) => {
    setDraft((d) => {
      if (!d) return d
      const steps = [...(d.steps || [])]
      steps[index] = { ...steps[index], ...partial, step_index: index }
      return { ...d, steps }
    })
  }

  const addStep = () => {
    setDraft((d) => {
      if (!d) return d
      const steps = [...(d.steps || [])]
      const next = emptyStep(steps.length)
      steps.push(next)
      setOpenStep(steps.length - 1)
      return { ...d, steps }
    })
    setEditing(true)
  }

  const removeStep = (index: number) => {
    setDraft((d) => {
      if (!d) return d
      const steps = (d.steps || [])
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, step_index: i }))
      return { ...d, steps }
    })
  }

  const moveStep = (index: number, dir: -1 | 1) => {
    setDraft((d) => {
      if (!d?.steps) return d
      const j = index + dir
      if (j < 0 || j >= d.steps.length) return d
      const steps = [...d.steps]
      ;[steps[index], steps[j]] = [steps[j], steps[index]]
      return { ...d, steps: steps.map((s, i) => ({ ...s, step_index: i })) }
    })
    setOpenStep(index + dir)
  }

  const save = async () => {
    if (!draft?.id) return
    setSaving(true)
    try {
      const body = {
        name: draft.name,
        description: draft.description,
        status: draft.status,
        trigger_type: draft.trigger_type,
        langs: draft.langs,
        require_marketing_consent: draft.require_marketing_consent,
        min_hours_between_emails: Number(draft.min_hours_between_emails) || 168,
        min_hours_between_push: Number(draft.min_hours_between_push) || 72,
        exit_on_paid: draft.exit_on_paid,
        exit_on_gift_claim: draft.exit_on_gift_claim,
        steps: (draft.steps || []).map((s, i) => ({
          step_index: i,
          anchor: s.anchor,
          offset_hours: Number(s.offset_hours) || 0,
          channel: s.channel,
          email_subject: s.email_subject || null,
          email_body: s.email_body || null,
          email_url: s.email_url || null,
          email_button_label: s.email_button_label || null,
          email_images: s.email_images || [],
          notif_title: s.notif_title || null,
          notif_body: s.notif_body || null,
          notif_url: s.notif_url || null,
          gift_code: (s.gift_code || '').trim() || null,
          enabled: s.enabled !== false,
        })),
      }
      const d = await adminFetch(`/admin/drips/${encodeURIComponent(draft.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      show('Sequence saved', 'ok')
      setDraft(d.sequence as Sequence)
      setEditing(false)
      await loadList()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Save failed', 'err')
    } finally {
      setSaving(false)
    }
  }

  const create = async () => {
    if (!newName.trim()) {
      show('Name is required', 'err')
      return
    }
    setCreating(true)
    try {
      const d = await adminFetch('/admin/drips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          langs: newLangs.length ? newLangs : ['el'],
          status: 'draft',
          steps: [emptyStep(0)],
        }),
      })
      const seq = d.sequence as Sequence
      show('Sequence created', 'ok')
      setCreateOpen(false)
      setNewName('')
      setNewLangs(['el'])
      await loadList()
      if (seq?.id) selectSequence(seq.id)
    } catch (e) {
      show(e instanceof Error ? e.message : 'Create failed', 'err')
    } finally {
      setCreating(false)
    }
  }

  const seedDefaults = async () => {
    setSeeding(true)
    try {
      const d = await adminFetch('/admin/drips/seed-defaults', { method: 'POST' })
      const n = ((d.sequences as Array<{ skipped?: boolean }>) || []).filter((x) => !x.skipped).length
      show(n ? `Seeded ${n} default sequence(s)` : 'Defaults already present', 'ok')
      await loadList()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Seed failed', 'err')
    } finally {
      setSeeding(false)
    }
  }

  const runNow = async () => {
    setRunning(true)
    try {
      const d = await adminFetch('/admin/drips/run-now', { method: 'POST' })
      const enroll = d.enroll as { enrolled?: number } | undefined
      const send = d.send as { sent_email?: number; sent_notif?: number } | undefined
      const enrolled = enroll?.enrolled ?? 0
      const sent = (send?.sent_email ?? 0) + (send?.sent_notif ?? 0)
      show(`Tick done — enrolled ${enrolled}, sent ${sent}`, 'ok')
      if (selectedId) await loadDetail(selectedId)
      await loadList()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Run failed', 'err')
    } finally {
      setRunning(false)
    }
  }

  const enrollPicked = async () => {
    if (!selectedId || !picked.length) return
    setEnrolling(true)
    try {
      const d = await adminFetch(`/admin/drips/${encodeURIComponent(selectedId)}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: picked.map((p) => p.id) }),
      })
      show(`Enrolled ${d.enrolled ?? 0} user(s)`, 'ok')
      setPicked([])
      await loadDetail(selectedId)
      await loadList()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Enroll failed', 'err')
    } finally {
      setEnrolling(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await adminFetch(`/admin/drips/${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' })
      show('Sequence deleted', 'ok')
      setDeleteTarget(null)
      if (selectedId === deleteTarget.id) {
        selectedIdRef.current = null
        setSelectedId(null)
        setDraft(null)
      }
      await loadList()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Delete failed', 'err')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="broadcast-stack">
      {Message}

      <div className="card">
        <div className="card-head">
          <h2>
            <Workflow size={16} className="h-icon" /> Conversion drips
          </h2>
          <div className="card-head-actions">
            <button type="button" className="sec sm" onClick={() => void loadList()} aria-busy={loading || undefined}>
              <RefreshCw size={14} className={loading ? 'icon-spin' : undefined} /> Refresh
            </button>
            <button type="button" className="sec sm" onClick={() => void seedDefaults()} disabled={seeding}>
              <Sprout size={14} /> {seeding ? 'Seeding…' : 'Seed EL + RO'}
            </button>
            <button type="button" className="sec sm" onClick={() => void runNow()} disabled={running}>
              <Play size={14} /> {running ? 'Running…' : 'Run tick now'}
            </button>
            <button type="button" className="pri sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New sequence
            </button>
          </div>
        </div>
        <p className="card-desc">
          Automated email + in-app/push sequences for never-paid trial users. Edit timing, copy,
          channels, and gift-code CTAs here — set status to <strong>active</strong> when ready.
          Caps default to ≤1 marketing email / week and ≤1 drip push / 3 days (editable per sequence).
          Runs via daily cron when available, plus a throttled backup whenever someone opens the app
          (<code>/auth/status</code>), and anytime you press <strong>Run tick now</strong>.
        </p>
        {statusNote ? <p className="meta">{statusNote}</p> : null}
        {setupError ? <div className="msg err">{setupError}</div> : null}
      </div>

      <div className="grid-2 drips-split">
        <div className="card">
          <div className="card-head">
            <h2>Sequences</h2>
          </div>
          {loading ? (
            <div className="empty">Loading…</div>
          ) : sequences.length === 0 ? (
            <div className="empty">No sequences yet. Seed defaults or create one.</div>
          ) : (
            sequences.map((row) => (
              <button
                key={row.id}
                type="button"
                className={`list-item drips-seq${selectedId === row.id ? ' is-selected' : ''}`}
                onClick={() => selectSequence(row.id)}
              >
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div className="t">
                    {statusBadge(row.status)} {row.name}
                  </div>
                  <div className="b">
                    {(row.langs || []).join(', ').toUpperCase()} · {row.step_count ?? 0} steps ·{' '}
                    {row.active_enrollments ?? 0} active
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="card">
          {!draft ? (
            <div className="empty">Select a sequence to edit.</div>
          ) : (
            <>
              <div className="card-head">
                <h2 style={{ margin: 0 }}>{draft.name}</h2>
                <div className="card-head-actions">
                  <FormLockControls
                    editing={editing}
                    onEdit={() => setEditing(true)}
                    onCancel={() => {
                      setEditing(false)
                      if (selectedId) void loadDetail(selectedId)
                    }}
                  />
                  {editing ? (
                    <button type="button" className="pri sm" onClick={() => void save()} disabled={saving}>
                      <Save size={14} /> {saving ? 'Saving…' : 'Save'}
                    </button>
                  ) : null}
                  <button type="button" className="del" onClick={() => setDeleteTarget(draft)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <FormLockBody editing={editing}>
                <div className="row">
                  <div className="field-wrap">
                    <FieldLabel required>Name</FieldLabel>
                    <input value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} />
                  </div>
                  <div className="field-wrap">
                    <FieldLabel>Status</FieldLabel>
                    <select
                      value={draft.status}
                      onChange={(e) => patchDraft({ status: e.target.value as Sequence['status'] })}
                    >
                      <option value="draft">draft</option>
                      <option value="active">active</option>
                      <option value="paused">paused</option>
                      <option value="archived">archived</option>
                    </select>
                  </div>
                </div>
                <div className="row">
                  <div className="field-wrap">
                    <FieldLabel>Trigger</FieldLabel>
                    <select
                      value={draft.trigger_type}
                      onChange={(e) => patchDraft({ trigger_type: e.target.value })}
                    >
                      <option value="never_paid_trial">Never-paid trial (auto)</option>
                      <option value="manual">Manual enroll only</option>
                    </select>
                  </div>
                  <div className="field-wrap">
                    <FieldLabel required>Languages</FieldLabel>
                    <MultiSelectSearch
                      options={langOptions}
                      value={draft.langs || []}
                      onChange={(langs) => patchDraft({ langs })}
                      placeholder="Languages"
                    />
                  </div>
                </div>
                <div className="row">
                  <div className="field-wrap">
                    <FieldLabel>Min hours between emails</FieldLabel>
                    <input
                      type="number"
                      min={24}
                      max={720}
                      value={draft.min_hours_between_emails}
                      onChange={(e) =>
                        patchDraft({ min_hours_between_emails: Number(e.target.value) || 168 })
                      }
                    />
                  </div>
                  <div className="field-wrap">
                    <FieldLabel>Min hours between push</FieldLabel>
                    <input
                      type="number"
                      min={12}
                      max={336}
                      value={draft.min_hours_between_push}
                      onChange={(e) =>
                        patchDraft({ min_hours_between_push: Number(e.target.value) || 72 })
                      }
                    />
                  </div>
                </div>
                <FieldLabel>Description</FieldLabel>
                <textarea
                  rows={2}
                  value={draft.description || ''}
                  onChange={(e) => patchDraft({ description: e.target.value })}
                />
                <div className="row" style={{ marginTop: 10 }}>
                  <label className="show-deleted-toggle">
                    <input
                      type="checkbox"
                      checked={!!draft.require_marketing_consent}
                      onChange={(e) => patchDraft({ require_marketing_consent: e.target.checked })}
                    />
                    Require marketing consent
                  </label>
                  <label className="show-deleted-toggle">
                    <input
                      type="checkbox"
                      checked={draft.exit_on_paid !== false}
                      onChange={(e) => patchDraft({ exit_on_paid: e.target.checked })}
                    />
                    Exit when user pays
                  </label>
                  <label className="show-deleted-toggle">
                    <input
                      type="checkbox"
                      checked={draft.exit_on_gift_claim !== false}
                      onChange={(e) => patchDraft({ exit_on_gift_claim: e.target.checked })}
                    />
                    Exit on gift claim
                  </label>
                </div>

                <div className="card-head" style={{ marginTop: 18 }}>
                  <h2 style={{ margin: 0 }}>Steps</h2>
                  <button type="button" className="sec sm" onClick={addStep} disabled={!editing}>
                    <Plus size={14} /> Add step
                  </button>
                </div>

                {(draft.steps || []).map((step, index) => {
                  const open = openStep === index
                  return (
                    <div key={index} className="drip-step">
                      <button
                        type="button"
                        className="drip-step__head"
                        onClick={() => setOpenStep(open ? null : index)}
                      >
                        <span>
                          <strong>Step {index + 1}</strong>
                          <span className="b">
                            {' '}
                            · {timingLabel(step)} · {step.channel}
                            {step.gift_code ? ` · gift ${step.gift_code}` : ''}
                          </span>
                        </span>
                        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {open ? (
                        <div className="drip-step__body">
                          <div className="card-head-actions" style={{ marginBottom: 10 }}>
                            <button
                              type="button"
                              className="sec sm"
                              disabled={!editing || index === 0}
                              onClick={() => moveStep(index, -1)}
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              className="sec sm"
                              disabled={!editing || index >= (draft.steps || []).length - 1}
                              onClick={() => moveStep(index, 1)}
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              className="del"
                              disabled={!editing}
                              onClick={() => removeStep(index)}
                            >
                              <Trash2 size={14} />
                            </button>
                            <label className="show-deleted-toggle">
                              <input
                                type="checkbox"
                                checked={step.enabled !== false}
                                disabled={!editing}
                                onChange={(e) => patchStep(index, { enabled: e.target.checked })}
                              />
                              Enabled
                            </label>
                          </div>
                          <div className="row">
                            <div className="field-wrap">
                              <FieldLabel>Anchor</FieldLabel>
                              <select
                                value={step.anchor}
                                onChange={(e) =>
                                  patchStep(index, { anchor: e.target.value as Step['anchor'] })
                                }
                              >
                                <option value="enrolled_at">After enrollment</option>
                                <option value="trial_ends_at">Relative to trial end</option>
                              </select>
                            </div>
                            <div className="field-wrap">
                              <FieldLabel>Offset hours (− before trial end)</FieldLabel>
                              <input
                                type="number"
                                value={step.offset_hours}
                                onChange={(e) =>
                                  patchStep(index, { offset_hours: Number(e.target.value) || 0 })
                                }
                              />
                            </div>
                          </div>
                          <div className="row">
                            <div className="field-wrap">
                              <FieldLabel>Channel</FieldLabel>
                              <select
                                value={step.channel}
                                onChange={(e) =>
                                  patchStep(index, { channel: e.target.value as Step['channel'] })
                                }
                              >
                                <option value="both">Email + notification</option>
                                <option value="email">Email only</option>
                                <option value="notification">Notification only</option>
                              </select>
                            </div>
                            <div className="field-wrap">
                              <FieldLabel>Gift code CTA</FieldLabel>
                              <select
                                value={step.gift_code || ''}
                                onChange={(e) => patchStep(index, { gift_code: e.target.value })}
                              >
                                <option value="">— none —</option>
                                {gifts.map((g) => (
                                  <option key={g.code} value={g.code}>
                                    {g.code}
                                    {g.label ? ` — ${g.label}` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {(step.channel === 'email' || step.channel === 'both') && (
                            <div className="drip-channel">
                              <h3>
                                <Mail size={14} /> Email
                              </h3>
                              <FieldLabel>Subject</FieldLabel>
                              <input
                                value={step.email_subject || ''}
                                onChange={(e) => patchStep(index, { email_subject: e.target.value })}
                              />
                              <FieldLabel>Body</FieldLabel>
                              <EmailBodyEditor
                                value={step.email_body || ''}
                                onChange={(v) => patchStep(index, { email_body: v })}
                                rows={7}
                              />
                              <div className="row">
                                <div className="field-wrap">
                                  <FieldLabel>Button URL</FieldLabel>
                                  <input
                                    value={step.email_url || ''}
                                    onChange={(e) => patchStep(index, { email_url: e.target.value })}
                                  />
                                </div>
                                <div className="field-wrap">
                                  <FieldLabel>Button label</FieldLabel>
                                  <input
                                    value={step.email_button_label || ''}
                                    onChange={(e) =>
                                      patchStep(index, { email_button_label: e.target.value })
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {(step.channel === 'notification' || step.channel === 'both') && (
                            <div className="drip-channel">
                              <h3>
                                <Bell size={14} /> In-app + push
                              </h3>
                              <FieldLabel>Title</FieldLabel>
                              <input
                                value={step.notif_title || ''}
                                maxLength={120}
                                onChange={(e) => patchStep(index, { notif_title: e.target.value })}
                              />
                              <FieldLabel>Body</FieldLabel>
                              <textarea
                                rows={3}
                                maxLength={500}
                                value={step.notif_body || ''}
                                onChange={(e) => patchStep(index, { notif_body: e.target.value })}
                              />
                              <FieldLabel>Tap URL</FieldLabel>
                              <input
                                value={step.notif_url || ''}
                                onChange={(e) => patchStep(index, { notif_url: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </FormLockBody>

              <div className="card" style={{ marginTop: 16, boxShadow: 'none' }}>
                <div className="card-head">
                  <h2>
                    <Users size={16} className="h-icon" /> Manual enroll
                  </h2>
                </div>
                <PeoplePicker picked={picked} onChange={setPicked} />
                <button
                  type="button"
                  className="pri sm"
                  style={{ marginTop: 12 }}
                  disabled={!picked.length || enrolling}
                  onClick={() => void enrollPicked()}
                >
                  {enrolling ? 'Enrolling…' : `Enroll ${picked.length || ''} selected`}
                </button>
              </div>

              <div className="grid-2" style={{ marginTop: 12 }}>
                <div>
                  <h3 style={{ fontSize: 14, marginBottom: 8 }}>Recent enrollments</h3>
                  {enrollments.length === 0 ? (
                    <p className="meta">None yet</p>
                  ) : (
                    enrollments.map((e) => (
                      <div key={e.id} className="meta" style={{ marginBottom: 6 }}>
                        {e.user_id.slice(0, 8)}… · {e.status} · step {e.next_step_index ?? 0} ·{' '}
                        {fmt(e.next_run_at)}
                        {e.exited_reason ? ` · ${e.exited_reason}` : ''}
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: 14, marginBottom: 8 }}>Recent sends</h3>
                  {sends.length === 0 ? (
                    <p className="meta">None yet</p>
                  ) : (
                    sends.map((s) => (
                      <div key={s.id} className="meta" style={{ marginBottom: 6 }}>
                        {s.channel} · {s.status} · {s.subject_or_title || '—'} · {fmt(s.sent_at)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {createOpen ? (
        <Modal title="New conversion sequence" onClose={() => setCreateOpen(false)}>
          <FieldLabel required>Name</FieldLabel>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <FieldLabel required>Languages</FieldLabel>
          <MultiSelectSearch
            options={langOptions}
            value={newLangs}
            onChange={setNewLangs}
            placeholder="Languages"
          />
          <div className="card-head-actions" style={{ marginTop: 16 }}>
            <button type="button" className="sec" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="button" className="pri" onClick={() => void create()} disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title="Delete sequence?" onClose={() => setDeleteTarget(null)}>
          <p>
            Delete <strong>{deleteTarget.name}</strong> and all enrollments / send logs?
          </p>
          <div className="card-head-actions" style={{ marginTop: 16 }}>
            <button type="button" className="sec" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button type="button" className="del" onClick={() => void remove()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
