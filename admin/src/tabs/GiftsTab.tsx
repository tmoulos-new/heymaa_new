import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Copy, Gift, Mail, Pencil, Plus, RefreshCw, RotateCcw, Trash2, X, AlertTriangle } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { datetimeLocalInputValue } from '../lib/datetime'
import { giftEmailDraft, giftNotificationDraft, stashComposeDraft } from '../lib/composeDraft'

type GiftRow = {
  id?: string
  code: string
  status?: string
  gift_type?: string
  plan_slot?: string | null
  days?: number | null
  points?: number | null
  label?: string | null
  notes?: string | null
  max_claims?: number | null
  claim_count?: number | null
  expires_at?: string | null
  created_at?: string
  is_deleted?: boolean
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'expired', label: 'Expired' },
]

const TYPE_OPTIONS = [
  { value: 'free_plan_days', label: 'Free plan days' },
  { value: 'bonus_points', label: 'Bonus points' },
  { value: 'combo', label: 'Days + points' },
]

function statusBadge(status: string) {
  const s = status || 'inactive'
  const cls = s === 'active' ? 'badge-ok' : s === 'expired' ? 'badge-warn' : 'badge-muted'
  return <span className={`badge ${cls}`}>{s}</span>
}

function rewardSummary(row: GiftRow) {
  const parts: string[] = []
  if (row.gift_type === 'free_plan_days' || row.gift_type === 'combo') {
    parts.push(`${row.days || 0} days ${(row.plan_slot || '').trim() || 'plan'}`)
  }
  if (row.gift_type === 'bonus_points' || row.gift_type === 'combo') {
    parts.push(`+${row.points || 0} pts`)
  }
  return parts.join(' · ') || '—'
}

function claimLink(code: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin.replace(/:\d+$/, '') : 'https://www.heymaa.ai'
  // Prefer production app host when admin runs on localhost ports.
  const base =
    origin.includes('localhost') || origin.includes('127.0.0.1')
      ? 'https://www.heymaa.ai'
      : origin
  return `${base}/app/auth?gift=${encodeURIComponent(code)}`
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

function randomCode() {
  const hex = Math.random().toString(16).slice(2, 8).toUpperCase()
  return `GIFT-${hex}`
}

export function GiftsTab() {
  const { adminFetch } = useAdmin()
  const navigate = useNavigate()
  const { show, Message } = useFlashMessage()
  const [gifts, setGifts] = useState<GiftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [newCode, setNewCode] = useState(randomCode())
  const [newType, setNewType] = useState('free_plan_days')
  const [newSlot, setNewSlot] = useState('starter')
  const [newDays, setNewDays] = useState('7')
  const [newPoints, setNewPoints] = useState('50')
  const [newLabel, setNewLabel] = useState('')
  const [newStatus, setNewStatus] = useState('active')
  const [newExpires, setNewExpires] = useState('')
  const [newMaxClaims, setNewMaxClaims] = useState('1')
  const [creating, setCreating] = useState(false)

  const [editRow, setEditRow] = useState<GiftRow | null>(null)
  const [editStatus, setEditStatus] = useState('active')
  const [editLabel, setEditLabel] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editExpires, setEditExpires] = useState('')
  const [editMaxClaims, setEditMaxClaims] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GiftRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = showDeleted ? '?deleted_only=true' : ''
      const d = await adminFetch(`/admin/gift_codes${qs}`)
      setGifts((d.gifts as GiftRow[]) || [])
      setSetupError(d.error ? String(d.error) : '')
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : 'Could not load gifts')
      setGifts([])
    } finally {
      setLoading(false)
    }
  }, [adminFetch, showDeleted])

  useEffect(() => {
    void load()
  }, [load])

  const resetCreate = () => {
    setNewCode(randomCode())
    setNewType('free_plan_days')
    setNewSlot('starter')
    setNewDays('7')
    setNewPoints('50')
    setNewLabel('')
    setNewStatus('active')
    setNewExpires('')
    setNewMaxClaims('1')
  }

  const create = async () => {
    setCreating(true)
    try {
      const body: Record<string, unknown> = {
        code: newCode.trim(),
        gift_type: newType,
        label: newLabel.trim() || undefined,
        status: newStatus,
        expires_at: newExpires ? new Date(newExpires).toISOString() : undefined,
        max_claims: newMaxClaims.trim() ? Number(newMaxClaims) : undefined,
      }
      if (newType === 'free_plan_days' || newType === 'combo') {
        body.plan_slot = newSlot
        body.days = Number(newDays)
      }
      if (newType === 'bonus_points' || newType === 'combo') {
        body.points = Number(newPoints)
      }
      const d = await adminFetch('/admin/gift_codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      show(`Created ${(d.gift as GiftRow)?.code || newCode}`, 'ok')
      setCreateOpen(false)
      resetCreate()
      await load()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Create failed', 'err')
    } finally {
      setCreating(false)
    }
  }

  const saveEdit = async () => {
    if (!editRow?.code) return
    setSaving(true)
    try {
      const d = await adminFetch(`/admin/gift_codes/${encodeURIComponent(editRow.code)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          label: editLabel,
          notes: editNotes,
          expires_at: editExpires ? new Date(editExpires).toISOString() : null,
          max_claims: editMaxClaims.trim() ? Number(editMaxClaims) : undefined,
          clear_max_claims: !editMaxClaims.trim(),
        }),
      })
      show(`Updated ${(d.gift as GiftRow)?.code || editRow.code}`, 'ok')
      setEditRow(null)
      await load()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Save failed', 'err')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget?.code) return
    setDeleting(true)
    try {
      await adminFetch(`/admin/gift_codes/${encodeURIComponent(deleteTarget.code)}`, { method: 'DELETE' })
      show('Gift archived', 'ok')
      setDeleteTarget(null)
      await load()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Delete failed', 'err')
    } finally {
      setDeleting(false)
    }
  }

  const restore = async (code: string) => {
    try {
      await adminFetch(`/admin/gift_codes/${encodeURIComponent(code)}/restore`, { method: 'POST' })
      show('Gift restored', 'ok')
      await load()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Restore failed', 'err')
    }
  }

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(claimLink(code))
      show('Claim link copied', 'ok')
    } catch {
      show(claimLink(code), 'ok')
    }
  }

  const composeEmail = (row: GiftRow) => {
    stashComposeDraft(giftEmailDraft(row))
    navigate('/emails')
  }

  const composeNotification = (row: GiftRow) => {
    stashComposeDraft(giftNotificationDraft(row))
    navigate('/notifications')
  }

  return (
    <div className="broadcast-stack">
      {Message}
      <div className="card broadcast-intro">
        <div className="card-head">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Gift size={18} />
            Gift codes
          </h2>
        </div>
        <p className="card-desc">
          Create redeemable gifts for moms: free Starter/Premium days, bonus points, or both.
          Copy the claim link, or open Emails / Notifications with a ready draft that uses the real gift CTA.
        </p>
      </div>

      {setupError ? (
        <div className="card">
          <p style={{ margin: 0 }}>{setupError}</p>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>{showDeleted ? 'Archived gifts' : 'Active gifts'}</h2>
          <div className="card-head-actions">
            <button type="button" className="sec sm" onClick={() => setShowDeleted((v) => !v)}>
              {showDeleted ? 'Show active' : 'Show archived'}
            </button>
            <button type="button" className="sec sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </button>
            {!showDeleted ? (
              <button
                type="button"
                className="teal sm"
                onClick={() => {
                  resetCreate()
                  setCreateOpen(true)
                }}
              >
                <Plus size={14} /> New gift
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <p className="muted" style={{ margin: 0 }}>Loading…</p>
        ) : gifts.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{showDeleted ? 'No archived gifts.' : 'No gifts yet.'}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Reward</th>
                  <th>Claims</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {gifts.map((row) => (
                  <tr key={row.id || row.code}>
                    <td>
                      <strong>{row.code}</strong>
                      {row.label ? <div className="muted" style={{ fontSize: 12 }}>{row.label}</div> : null}
                    </td>
                    <td>{rewardSummary(row)}</td>
                    <td>
                      {row.claim_count ?? 0}
                      {row.max_claims != null ? ` / ${row.max_claims}` : ' / ∞'}
                    </td>
                    <td>{statusBadge(row.status || 'inactive')}</td>
                    <td>{row.expires_at ? new Date(row.expires_at).toLocaleString() : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {showDeleted ? (
                          <button type="button" className="ghost sm" onClick={() => void restore(row.code)}>
                            <RotateCcw size={14} /> Restore
                          </button>
                        ) : (
                          <>
                            <button type="button" className="ghost sm" onClick={() => void copyLink(row.code)} title="Copy claim link">
                              <Copy size={14} />
                            </button>
                            <button type="button" className="ghost sm" onClick={() => composeEmail(row)} title="Compose email">
                              <Mail size={14} />
                            </button>
                            <button type="button" className="ghost sm" onClick={() => composeNotification(row)} title="Compose notification">
                              <Bell size={14} />
                            </button>
                            <button
                              type="button"
                              className="ghost sm"
                              onClick={() => {
                                setEditRow(row)
                                setEditStatus(row.status || 'active')
                                setEditLabel(row.label || '')
                                setEditNotes(row.notes || '')
                                setEditExpires(datetimeLocalInputValue(row.expires_at || ''))
                                setEditMaxClaims(row.max_claims != null ? String(row.max_claims) : '')
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button type="button" className="ghost sm" onClick={() => setDeleteTarget(row)}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen ? (
        <Modal title="New gift" onClose={() => setCreateOpen(false)}>
          <div className="field-wrap">
            <FieldLabel required>Code</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} />
              <button type="button" className="sec sm" onClick={() => setNewCode(randomCode())}>
                Random
              </button>
            </div>
          </div>
          <div className="field-wrap">
            <FieldLabel required>Type</FieldLabel>
            <select value={newType} onChange={(e) => setNewType(e.target.value)}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {newType === 'free_plan_days' || newType === 'combo' ? (
            <div className="email-cta-grid">
              <div className="field-wrap">
                <FieldLabel required>Plan</FieldLabel>
                <select value={newSlot} onChange={(e) => setNewSlot(e.target.value)}>
                  <option value="starter">Starter</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div className="field-wrap">
                <FieldLabel required>Days</FieldLabel>
                <input type="number" min={1} max={365} value={newDays} onChange={(e) => setNewDays(e.target.value)} />
              </div>
            </div>
          ) : null}
          {newType === 'bonus_points' || newType === 'combo' ? (
            <div className="field-wrap">
              <FieldLabel required>Points</FieldLabel>
              <input type="number" min={1} max={100000} value={newPoints} onChange={(e) => setNewPoints(e.target.value)} />
            </div>
          ) : null}
          <div className="field-wrap">
            <FieldLabel>Label</FieldLabel>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Spring campaign" />
          </div>
          <div className="email-cta-grid">
            <div className="field-wrap">
              <FieldLabel>Status</FieldLabel>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="field-wrap">
              <FieldLabel>Max claims</FieldLabel>
              <input value={newMaxClaims} onChange={(e) => setNewMaxClaims(e.target.value)} placeholder="blank = unlimited" />
            </div>
          </div>
          <div className="field-wrap">
            <FieldLabel>Expires</FieldLabel>
            <input type="datetime-local" value={newExpires} onChange={(e) => setNewExpires(e.target.value)} />
          </div>
          <div className="composer-actions">
            <button type="button" className="sec" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className="teal" disabled={creating} onClick={() => void create()}>
              {creating ? 'Creating…' : 'Create gift'}
            </button>
          </div>
        </Modal>
      ) : null}

      {editRow ? (
        <Modal title={`Edit ${editRow.code}`} onClose={() => setEditRow(null)}>
          <p className="field-hint" style={{ marginTop: 0 }}>Reward: {rewardSummary(editRow)}</p>
          <div className="field-wrap">
            <FieldLabel>Label</FieldLabel>
            <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
          </div>
          <div className="field-wrap">
            <FieldLabel>Notes</FieldLabel>
            <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </div>
          <div className="email-cta-grid">
            <div className="field-wrap">
              <FieldLabel>Status</FieldLabel>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="field-wrap">
              <FieldLabel>Max claims</FieldLabel>
              <input value={editMaxClaims} onChange={(e) => setEditMaxClaims(e.target.value)} placeholder="blank = unlimited" />
            </div>
          </div>
          <div className="field-wrap">
            <FieldLabel>Expires</FieldLabel>
            <input type="datetime-local" value={editExpires} onChange={(e) => setEditExpires(e.target.value)} />
          </div>
          <div className="composer-actions">
            <button type="button" className="sec" onClick={() => setEditRow(null)}>Cancel</button>
            <button type="button" className="teal" disabled={saving} onClick={() => void saveEdit()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title="Archive gift?" onClose={() => setDeleteTarget(null)}>
          <p style={{ marginTop: 0 }}>
            <AlertTriangle size={16} style={{ verticalAlign: -2, marginRight: 6 }} />
            Archive <strong>{deleteTarget.code}</strong>? Existing claims stay; the code stops being redeemable.
          </p>
          <div className="composer-actions">
            <button type="button" className="sec" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button type="button" className="teal" disabled={deleting} onClick={() => void remove()}>
              {deleting ? 'Archiving…' : 'Archive'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
