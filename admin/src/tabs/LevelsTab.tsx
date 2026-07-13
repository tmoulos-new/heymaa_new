import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, Pencil, Plus, RefreshCw, Trash2, Trophy, X } from 'lucide-react'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { apiDetail } from '../lib/api'
import type { LevelRow } from '../lib/types'

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
        aria-labelledby="levels-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="levels-modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

function nextLevelPoints(levels: LevelRow[], row: LevelRow): number | null {
  const sorted = [...levels].sort((a, b) => a.sort_order - b.sort_order)
  const idx = sorted.findIndex((l) => l.id === row.id)
  if (idx < 0 || idx >= sorted.length - 1) return null
  return sorted[idx + 1].min_points - row.min_points
}

export function LevelsTab() {
  const { adminFetch } = useAdmin()
  const { show } = useFlashMessage()
  const [levels, setLevels] = useState<LevelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [newId, setNewId] = useState('')
  const [newSortOrder, setNewSortOrder] = useState('')
  const [newMinPoints, setNewMinPoints] = useState('0')
  const [newNameEl, setNewNameEl] = useState('')
  const [newNameEn, setNewNameEn] = useState('')
  const [creating, setCreating] = useState(false)

  const [editRow, setEditRow] = useState<LevelRow | null>(null)
  const [editSortOrder, setEditSortOrder] = useState('')
  const [editMinPoints, setEditMinPoints] = useState('')
  const [editNameEl, setEditNameEl] = useState('')
  const [editNameEn, setEditNameEn] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<LevelRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadLevels = useCallback(async () => {
    setLoading(true)
    setErr(false)
    try {
      const d = await adminFetch('/admin/levels')
      setLevels((d.levels as LevelRow[]) || [])
    } catch {
      setErr(true)
      setLevels([])
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => {
    void loadLevels()
  }, [loadLevels])

  const openEdit = (row: LevelRow) => {
    setEditRow(row)
    setEditSortOrder(String(row.sort_order))
    setEditMinPoints(String(row.min_points))
    setEditNameEl(row.name_el)
    setEditNameEn(row.name_en)
  }

  const createLevel = async () => {
    const id = Number(newId)
    const sortOrder = Number(newSortOrder)
    const minPoints = Number(newMinPoints)
    if (!Number.isInteger(id) || id < 1) {
      show('Level id must be a positive integer', 'err')
      return
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 1) {
      show('Sort order must be a positive integer', 'err')
      return
    }
    if (!Number.isInteger(minPoints) || minPoints < 0) {
      show('Min points must be 0 or greater', 'err')
      return
    }
    if (!newNameEl.trim() || !newNameEn.trim()) {
      show('Greek and English names are required', 'err')
      return
    }
    setCreating(true)
    try {
      const d = await adminFetch('/admin/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          sort_order: sortOrder,
          min_points: minPoints,
          name_el: newNameEl.trim(),
          name_en: newNameEn.trim(),
        }),
      })
      if (d.ok) {
        show('Level created ✓', 'ok')
        setCreateOpen(false)
        setNewId('')
        setNewSortOrder('')
        setNewMinPoints('0')
        setNewNameEl('')
        setNewNameEn('')
        void loadLevels()
      } else {
        show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Failed', 'err')
    } finally {
      setCreating(false)
    }
  }

  const saveEdit = async () => {
    if (!editRow) return
    const sortOrder = Number(editSortOrder)
    const minPoints = Number(editMinPoints)
    if (!Number.isInteger(sortOrder) || sortOrder < 1) {
      show('Sort order must be a positive integer', 'err')
      return
    }
    if (!Number.isInteger(minPoints) || minPoints < 0) {
      show('Min points must be 0 or greater', 'err')
      return
    }
    if (!editNameEl.trim() || !editNameEn.trim()) {
      show('Greek and English names are required', 'err')
      return
    }
    setSaving(true)
    try {
      const d = await adminFetch(`/admin/levels/${editRow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sort_order: sortOrder,
          min_points: minPoints,
          name_el: editNameEl.trim(),
          name_en: editNameEn.trim(),
        }),
      })
      if (d.ok) {
        show('Level updated ✓', 'ok')
        setEditRow(null)
        void loadLevels()
      } else {
        show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Failed', 'err')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await adminFetch(`/admin/levels/${deleteTarget.id}`, { method: 'DELETE' })
      show('Level deleted', 'ok')
      setDeleteTarget(null)
      void loadLevels()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Delete failed', 'err')
    } finally {
      setDeleting(false)
    }
  }

  const sortedLevels = [...levels].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>
            <Trophy size={16} className="h-icon" /> Levels
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="sec sm" onClick={() => void loadLevels()}>
              <RefreshCw size={14} />
            </button>
            <button type="button" className="sec sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New
            </button>
          </div>
        </div>
        <p className="card-desc">
          Gamification levels for moms in the app. Entry threshold is cumulative points from activity.
          Users are assigned a level automatically when they earn enough points.
        </p>

        {loading && <div className="empty">Loading…</div>}
        {err && <div className="msg err">Failed to load levels</div>}
        {!loading && !err && sortedLevels.length === 0 && (
          <div className="empty">No levels yet. Create one to get started.</div>
        )}

        {!loading &&
          !err &&
          sortedLevels.map((row) => {
            const step = nextLevelPoints(sortedLevels, row)
            return (
              <div key={row.id} className="list-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">
                    <span className="badge badge-ok">Lv {row.id}</span>
                    {row.name_el} / {row.name_en}
                  </div>
                  <div className="b">
                    Entry: {row.min_points} pts
                    {step != null ? ` · +${step} pts to level up` : ' · Max level'}
                    {' · '}sort {row.sort_order}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button type="button" className="sec sm" onClick={() => openEdit(row)}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="del" onClick={() => setDeleteTarget(row)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
      </div>

      {createOpen && (
        <Modal title="New level" onClose={() => !creating && setCreateOpen(false)}>
          <FieldLabel required>Level id</FieldLabel>
          <input
            type="number"
            min={1}
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="e.g. 6"
          />
          <FieldLabel required>Sort order</FieldLabel>
          <input
            type="number"
            min={1}
            value={newSortOrder}
            onChange={(e) => setNewSortOrder(e.target.value)}
            placeholder="Display order"
          />
          <FieldLabel required>Entry points (cumulative)</FieldLabel>
          <input
            type="number"
            min={0}
            value={newMinPoints}
            onChange={(e) => setNewMinPoints(e.target.value)}
          />
          <FieldLabel required>Greek name</FieldLabel>
          <input value={newNameEl} onChange={(e) => setNewNameEl(e.target.value)} placeholder="π.χ. Νέα Μαμά" />
          <FieldLabel required>English name</FieldLabel>
          <input value={newNameEn} onChange={(e) => setNewNameEn(e.target.value)} placeholder="e.g. New Mom" />
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </button>
            <button type="button" onClick={() => void createLevel()} disabled={creating}>
              {creating ? 'Saving…' : 'Create level'}
            </button>
          </div>
        </Modal>
      )}

      {editRow && (
        <Modal title={`Edit level ${editRow.id}`} onClose={() => !saving && setEditRow(null)}>
          <FieldLabel required>Sort order</FieldLabel>
          <input
            type="number"
            min={1}
            value={editSortOrder}
            onChange={(e) => setEditSortOrder(e.target.value)}
          />
          <FieldLabel required>Entry points (cumulative)</FieldLabel>
          <input
            type="number"
            min={0}
            value={editMinPoints}
            onChange={(e) => setEditMinPoints(e.target.value)}
          />
          <FieldLabel required>Greek name</FieldLabel>
          <input value={editNameEl} onChange={(e) => setEditNameEl(e.target.value)} />
          <FieldLabel required>English name</FieldLabel>
          <input value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} />
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={() => setEditRow(null)} disabled={saving}>
              Cancel
            </button>
            <button type="button" onClick={() => void saveEdit()} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete level?" onClose={() => !deleting && setDeleteTarget(null)}>
          <p className="card-desc" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Delete <strong>{deleteTarget.name_en}</strong> (id {deleteTarget.id})? This fails if any
              users are still assigned to this level.
            </span>
          </p>
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className="del" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete level'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
