import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Globe2, Pencil, Plus, RefreshCw, Trash2, X, AlertTriangle } from 'lucide-react'
import { MultiSelectSearch } from '../components/MultiSelectSearch'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { apiDetail } from '../lib/api'
import { LANG_OPTIONS } from '../lib/constants'
import type { RegionRow } from '../lib/types'

function langLabels(codes: string[] | undefined) {
  if (!codes?.length) return '—'
  return codes
    .map((c) => LANG_OPTIONS.find((l) => l.value === c)?.label || c)
    .join(', ')
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
        aria-labelledby="regions-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="regions-modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function RegionsTab() {
  const { adminFetch } = useAdmin()
  const { show } = useFlashMessage()
  const [regions, setRegions] = useState<RegionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLangs, setNewLangs] = useState<string[]>([])
  const [newActive, setNewActive] = useState(true)
  const [creating, setCreating] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLangs, setEditLangs] = useState<string[]>([])
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<RegionRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const langOptions = LANG_OPTIONS.map((l) => ({ value: l.value, label: l.label }))

  const loadRegions = useCallback(async () => {
    setLoading(true)
    setErr(false)
    try {
      const d = await adminFetch('/admin/regions')
      setRegions((d.regions as RegionRow[]) || [])
    } catch {
      setErr(true)
      setRegions([])
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => {
    void loadRegions()
  }, [loadRegions])

  const openEdit = (row: RegionRow) => {
    setEditId(row.id)
    setEditName(row.name)
    setEditLangs(row.languages || [])
    setEditActive(row.active !== false)
  }

  const createRegion = async () => {
    if (!newName.trim()) {
      show('Name is required', 'err')
      return
    }
    if (newLangs.length === 0) {
      show('Select at least one language', 'err')
      return
    }
    setCreating(true)
    try {
      const d = await adminFetch('/admin/regions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          languages: newLangs,
          active: newActive,
        }),
      })
      if (d.ok) {
        show('Region created ✓', 'ok')
        setCreateOpen(false)
        setNewName('')
        setNewLangs([])
        setNewActive(true)
        void loadRegions()
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
    if (!editId) return
    if (!editName.trim()) {
      show('Name is required', 'err')
      return
    }
    if (editLangs.length === 0) {
      show('Select at least one language', 'err')
      return
    }
    setSaving(true)
    try {
      const d = await adminFetch(`/admin/regions/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          languages: editLangs,
          active: editActive,
        }),
      })
      if (d.ok) {
        show('Region updated ✓', 'ok')
        setEditId(null)
        void loadRegions()
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
      await adminFetch(`/admin/regions/${deleteTarget.id}`, { method: 'DELETE' })
      show('Region deleted', 'ok')
      setDeleteTarget(null)
      void loadRegions()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Delete failed', 'err')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>
            <Globe2 size={16} className="h-icon" /> Regions
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="sec sm" onClick={() => void loadRegions()}>
              <RefreshCw size={14} />
            </button>
            <button type="button" className="sec sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New
            </button>
          </div>
        </div>
        <p className="card-desc">
          Regions group languages for targeting offers and promotions. Leave offers/promos unassigned to show
          everywhere.
        </p>

        {loading && <div className="empty">Loading…</div>}
        {err && <div className="msg err">Failed to load regions</div>}
        {!loading && !err && regions.length === 0 && (
          <div className="empty">No regions yet. Create one to get started.</div>
        )}

        {!loading &&
          !err &&
          regions.map((r) => (
            <div key={r.id} className="list-item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t">
                  <span className={`badge ${r.active === false ? 'badge-muted' : 'badge-ok'}`}>
                    {r.active === false ? 'inactive' : 'active'}
                  </span>
                  {r.name}
                </div>
                <div className="b">{langLabels(r.languages)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button type="button" className="sec sm" onClick={() => openEdit(r)}>
                  <Pencil size={14} />
                </button>
                <button type="button" className="del" onClick={() => setDeleteTarget(r)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
      </div>

      {createOpen && (
        <Modal title="New region" onClose={() => !creating && setCreateOpen(false)}>
          <FieldLabel required>Name</FieldLabel>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Greece & Cyprus"
          />
          <FieldLabel required>Languages</FieldLabel>
          <MultiSelectSearch options={langOptions} value={newLangs} onChange={setNewLangs} />
          <label className="checkbox-row" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} /> Active
          </label>
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </button>
            <button type="button" onClick={() => void createRegion()} disabled={creating}>
              {creating ? 'Saving…' : 'Create region'}
            </button>
          </div>
        </Modal>
      )}

      {editId && (
        <Modal title="Edit region" onClose={() => !saving && setEditId(null)}>
          <FieldLabel required>Name</FieldLabel>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} />
          <FieldLabel required>Languages</FieldLabel>
          <MultiSelectSearch options={langOptions} value={editLangs} onChange={setEditLangs} />
          <label className="checkbox-row" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} /> Active
          </label>
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={() => setEditId(null)} disabled={saving}>
              Cancel
            </button>
            <button type="button" onClick={() => void saveEdit()} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete region?" onClose={() => !deleting && setDeleteTarget(null)}>
          <p className="card-desc" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Delete <strong>{deleteTarget.name}</strong>? Offers and promotions linked to this region will lose
              that association.
            </span>
          </p>
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className="del" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

    </>
  )
}
