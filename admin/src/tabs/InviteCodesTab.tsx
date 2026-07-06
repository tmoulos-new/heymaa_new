import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { KeyRound, Pencil, Plus, RefreshCw, RotateCcw, Trash2, X, AlertTriangle } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { apiDetail } from '../lib/api'
import { datetimeLocalInputValue } from '../lib/datetime'
import { TESTER_CODES } from '../lib/constants'
import type { InviteCodeRow } from '../lib/types'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'expired', label: 'Expired' },
]

function statusBadge(status: string) {
  const s = status || 'inactive'
  const cls = s === 'active' ? 'badge-ok' : s === 'expired' ? 'badge-warn' : 'badge-muted'
  return <span className={`badge ${cls}`}>{s}</span>
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
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function InviteCodesTab() {
  const { adminFetch } = useAdmin()
  const { show } = useFlashMessage()
  const [codes, setCodes] = useState<InviteCodeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newStatus, setNewStatus] = useState('active')
  const [newExpires, setNewExpires] = useState('')
  const [creating, setCreating] = useState(false)

  const [editCode, setEditCode] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState('active')
  const [editLabel, setEditLabel] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editExpires, setEditExpires] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [restoringCode, setRestoringCode] = useState<string | null>(null)

  const loadCodes = useCallback(async () => {
    setLoading(true)
    setErr(false)
    try {
      const qs = showDeleted ? '?deleted_only=true' : ''
      const d = await adminFetch(`/admin/invite_codes${qs}`)
      const list = (d.codes as InviteCodeRow[]) || []
      setCodes(list.length ? list : showDeleted ? [] : TESTER_CODES.map((c) => ({ code: c, status: 'active' })))
    } catch {
      setErr(true)
      setCodes(showDeleted ? [] : TESTER_CODES.map((c) => ({ code: c, status: 'active' })))
    } finally {
      setLoading(false)
    }
  }, [adminFetch, showDeleted])

  useEffect(() => {
    void loadCodes()
  }, [loadCodes])

  const resetCreateForm = () => {
    setNewCode('')
    setNewLabel('')
    setNewStatus('active')
    setNewExpires('')
  }

  const closeCreate = () => {
    setCreateOpen(false)
    resetCreateForm()
  }

  const startEdit = (row: InviteCodeRow) => {
    setEditCode(row.code)
    setEditStatus(row.status || 'active')
    setEditLabel(row.label || '')
    setEditNotes(row.notes || '')
    setEditExpires(datetimeLocalInputValue(row.expires_at))
  }

  const cancelEdit = () => {
    setEditCode(null)
    setEditLabel('')
    setEditNotes('')
    setEditExpires('')
  }

  const createCode = async () => {
    const code = newCode.trim()
    if (!code) {
      show('Code is required', 'err')
      return
    }
    setCreating(true)
    try {
      const d = await adminFetch('/admin/invite_codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          status: newStatus,
          label: newLabel.trim() || null,
          expires_at: newExpires ? new Date(newExpires).toISOString() : null,
        }),
      })
      if (!d.ok) {
        show(apiDetail(d) || 'Could not create code', 'err')
        return
      }
      show(`Created ${code}`, 'ok')
      closeCreate()
      void loadCodes()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    } finally {
      setCreating(false)
    }
  }

  const saveEdit = async () => {
    if (!editCode) return
    setSaving(true)
    try {
      const d = await adminFetch(`/admin/invite_codes/${encodeURIComponent(editCode)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          label: editLabel.trim() || null,
          notes: editNotes.trim() || null,
          expires_at: editExpires ? new Date(editExpires).toISOString() : null,
        }),
      })
      if (!d.ok) {
        show(apiDetail(d) || 'Could not save', 'err')
        return
      }
      show(`Updated ${editCode}`, 'ok')
      cancelEdit()
      void loadCodes()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const code = deleteTarget
    setDeleting(true)
    try {
      const d = await adminFetch(`/admin/invite_codes/${encodeURIComponent(code)}`, { method: 'DELETE' })
      if (!d.ok) {
        show(apiDetail(d) || 'Could not delete', 'err')
        return
      }
      show(`Soft-deleted ${code}`, 'ok')
      setDeleteTarget(null)
      if (editCode === code) cancelEdit()
      void loadCodes()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    } finally {
      setDeleting(false)
    }
  }

  const restoreCode = async (code: string) => {
    setRestoringCode(code)
    try {
      const d = await adminFetch(`/admin/invite_codes/${encodeURIComponent(code)}/restore`, { method: 'POST' })
      if (!d.ok) {
        show(apiDetail(d) || 'Could not restore', 'err')
        return
      }
      show(`Restored ${code}`, 'ok')
      if (editCode === code) cancelEdit()
      void loadCodes()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    } finally {
      setRestoringCode(null)
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>
            <KeyRound size={16} className="h-icon" /> Invite codes
          </h2>
          <div className="card-head-actions">
            <label className="show-deleted-toggle">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              Show deleted
            </label>
            <button type="button" className="sec sm" onClick={() => void loadCodes()}>
              <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Refresh
            </button>
            {!showDeleted && (
              <button type="button" className="teal sm" onClick={() => setCreateOpen(true)}>
                <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> New invite code
              </button>
            )}
          </div>
        </div>
        {loading && <div className="empty">Loading…</div>}
        {err && <div className="msg err">Could not load from database — showing defaults.</div>}
        {!loading && codes.length === 0 && (
          <div className="empty">{showDeleted ? 'No deleted invite codes.' : 'No invite codes yet.'}</div>
        )}
        {!loading && codes.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Label</th>
                  <th>Created by</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {codes.map((row) => (
                  <tr key={row.code} className={row.is_deleted || showDeleted ? 'is-deleted' : ''}>
                    <td>
                      <code>{row.code}</code>
                      {(row.is_deleted || showDeleted) && (
                        <div>
                          <span className="badge badge-warn" style={{ marginTop: 4 }}>
                            deleted
                          </span>
                        </div>
                      )}
                    </td>
                    <td>{statusBadge(row.status)}</td>
                    <td>{row.label || '—'}</td>
                    <td>{row.created_by_name || '—'}</td>
                    <td>{row.expires_at ? new Date(row.expires_at).toLocaleString() : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {row.is_deleted || showDeleted ? (
                        <button
                          type="button"
                          className="ghost sm"
                          disabled={restoringCode === row.code}
                          onClick={() => void restoreCode(row.code)}
                          title="Restore"
                        >
                          <RotateCcw size={14} />
                        </button>
                      ) : (
                        <>
                          <button type="button" className="ghost sm" onClick={() => startEdit(row)} title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="ghost sm"
                            onClick={() => setDeleteTarget(row.code)}
                            title="Soft delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <Modal title="New invite code" onClose={closeCreate}>
          <p className="card-desc" style={{ marginTop: 0 }}>
            Beta testers sign in with the code as their session token. Only <strong>active</strong> codes are
            accepted by the app.
          </p>
          <FieldLabel required>Code</FieldLabel>
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="HeyMaa_Tester31"
            autoFocus
          />
          <FieldLabel>Label</FieldLabel>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Beta tester 31"
          />
          <div className="row">
            <div style={{ flex: 1 }}>
              <FieldLabel>Status</FieldLabel>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Expires (optional)</FieldLabel>
              <input
                type="datetime-local"
                value={newExpires}
                onChange={(e) => setNewExpires(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={closeCreate}>
              Cancel
            </button>
            <button type="button" className="teal" disabled={creating} onClick={() => void createCode()}>
              {creating ? 'Creating…' : 'Create code'}
            </button>
          </div>
        </Modal>
      )}

      {editCode && (
        <Modal title={`Edit ${editCode}`} onClose={cancelEdit}>
          <div className="row">
            <div style={{ flex: 1 }}>
              <FieldLabel>Status</FieldLabel>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Expires</FieldLabel>
              <input
                type="datetime-local"
                value={editExpires}
                onChange={(e) => setEditExpires(e.target.value)}
              />
            </div>
          </div>
          <FieldLabel>Label</FieldLabel>
          <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
          <FieldLabel>Notes (internal)</FieldLabel>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={3}
            placeholder="Optional admin notes"
          />
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={cancelEdit}>
              Cancel
            </button>
            <button type="button" className="teal" disabled={saving} onClick={() => void saveEdit()}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Soft delete invite code?" onClose={() => !deleting && setDeleteTarget(null)}>
          <div className="confirm-dialog">
            <div className="confirm-icon" aria-hidden="true">
              <AlertTriangle size={22} />
            </div>
            <p>
              Soft-delete <code>{deleteTarget}</code>? Anyone using this code will no longer be able to sign in,
              but you can restore it later from the deleted list.
            </p>
          </div>
          <div className="modal-foot">
            <button type="button" className="ghost" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button type="button" className="del" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? 'Deleting…' : 'Soft delete'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
