/** Admin: edit points awarded per app action. */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Coins, Pencil, RefreshCw, X } from 'lucide-react'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { apiDetail } from '../lib/api'
import type { PointRuleRow, PointSettingRow } from '../lib/types'

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
        aria-labelledby="points-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="points-modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

function formatPoints(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

export function PointsTab() {
  const { adminFetch } = useAdmin()
  const { show } = useFlashMessage()
  const [rules, setRules] = useState<PointRuleRow[]>([])
  const [settings, setSettings] = useState<PointSettingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [tableReady, setTableReady] = useState(true)

  const [editRow, setEditRow] = useState<PointRuleRow | null>(null)
  const [editPoints, setEditPoints] = useState('0')
  const [editLabelEl, setEditLabelEl] = useState('')
  const [editLabelEn, setEditLabelEn] = useState('')
  const [editVisible, setEditVisible] = useState(true)
  const [saving, setSaving] = useState(false)

  const [editCap, setEditCap] = useState(false)
  const [capValue, setCapValue] = useState('30')
  const [savingCap, setSavingCap] = useState(false)

  const chatCap = settings.find((s) => s.key === 'chat_daily_points_cap')

  const loadRules = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const d = (await adminFetch('/admin/point_rules')) as {
        rules?: PointRuleRow[]
        settings?: PointSettingRow[]
        table_ready?: boolean
        error?: string
      }
      setRules(d.rules || [])
      setSettings(d.settings || [])
      setTableReady(d.table_ready !== false)
      if (d.error) setErr(String(d.error))
    } catch (e) {
      setErr((e instanceof Error && e.message) || 'Failed to load point rules')
      setRules([])
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const openEdit = (row: PointRuleRow) => {
    setEditRow(row)
    setEditPoints(String(row.points))
    setEditLabelEl(row.label_el)
    setEditLabelEn(row.label_en)
    setEditVisible(row.visible !== false)
  }

  const saveEdit = async () => {
    if (!editRow) return
    const points = Number(editPoints)
    if (!Number.isInteger(points)) {
      show('Points must be a whole number', 'err')
      return
    }
    if (!editLabelEl.trim() || !editLabelEn.trim()) {
      show('Greek and English labels are required', 'err')
      return
    }
    setSaving(true)
    try {
      const d = await adminFetch(`/admin/point_rules/${editRow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points,
          label_el: editLabelEl.trim(),
          label_en: editLabelEn.trim(),
          visible: editVisible,
        }),
      })
      if (d.ok) {
        show('Points updated ✓', 'ok')
        setEditRow(null)
        if (Array.isArray(d.rules)) setRules(d.rules as PointRuleRow[])
        else void loadRules()
      } else {
        show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Failed', 'err')
    } finally {
      setSaving(false)
    }
  }

  const saveCap = async () => {
    const value = Number(capValue)
    if (!Number.isInteger(value) || value < 0) {
      show('Daily cap must be 0 or greater', 'err')
      return
    }
    setSavingCap(true)
    try {
      const d = await adminFetch('/admin/point_settings/chat_daily_points_cap', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value_int: value }),
      })
      if (d.ok) {
        show('Chat cap updated ✓', 'ok')
        setEditCap(false)
        if (Array.isArray(d.settings)) setSettings(d.settings as PointSettingRow[])
        else void loadRules()
      } else {
        show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Failed', 'err')
    } finally {
      setSavingCap(false)
    }
  }

  const sorted = [...rules].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>
            <Coins size={16} className="h-icon" /> Points per action
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="sec sm" onClick={() => void loadRules()}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
        <p className="card-desc">
          These values are awarded live in the app (memories, chat, milestones, referrals). Changing a
          milestone amount also updates untick to the negative of the same value. Existing earned
          points are not rewritten.
        </p>

        {!tableReady && (
          <div className="msg err">
            {err || 'Run backend/migrations/point_rules.sql in the Supabase SQL Editor, then refresh.'}
          </div>
        )}
        {loading && <div className="empty">Loading…</div>}
        {tableReady && err && !loading && <div className="msg err">{err}</div>}

        {!loading && chatCap && (
          <div className="list-item">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t">{chatCap.label_en}</div>
              <div className="b">
                {chatCap.label_el} · {chatCap.value_int} pts / day
              </div>
            </div>
            <button
              type="button"
              className="sec sm"
              onClick={() => {
                setCapValue(String(chatCap.value_int))
                setEditCap(true)
              }}
            >
              <Pencil size={14} />
            </button>
          </div>
        )}

        {!loading &&
          sorted.map((row) => (
            <div key={row.id} className="list-item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t">
                  <span className={`badge ${row.points < 0 ? 'badge-warn' : 'badge-ok'}`}>
                    {formatPoints(row.points)}
                  </span>{' '}
                  {row.label_el} / {row.label_en}
                  {row.visible === false ? (
                    <span className="badge" style={{ marginLeft: 8 }}>
                      hidden
                    </span>
                  ) : null}
                </div>
                <div className="b">
                  {row.action} · {row.path}
                </div>
              </div>
              <button type="button" className="sec sm" onClick={() => openEdit(row)} disabled={!tableReady}>
                <Pencil size={14} />
              </button>
            </div>
          ))}
      </div>

      {editRow && (
        <Modal title={`Edit ${editRow.label_en}`} onClose={() => !saving && setEditRow(null)}>
          <FieldLabel required>Points</FieldLabel>
          <input
            type="number"
            step={1}
            value={editPoints}
            onChange={(e) => setEditPoints(e.target.value)}
          />
          <FieldLabel required>Greek label</FieldLabel>
          <input value={editLabelEl} onChange={(e) => setEditLabelEl(e.target.value)} />
          <FieldLabel required>English label</FieldLabel>
          <input value={editLabelEn} onChange={(e) => setEditLabelEn(e.target.value)} />
          <label className="check-row" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
            <input
              type="checkbox"
              checked={editVisible}
              onChange={(e) => setEditVisible(e.target.checked)}
            />
            Show on mom profile / FAQ
          </label>
          {editRow.path === '/app/milestones/check' ? (
            <p className="card-desc">Untick will automatically become the negative of this amount.</p>
          ) : null}
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

      {editCap && (
        <Modal title="Daily chat points cap" onClose={() => !savingCap && setEditCap(false)}>
          <FieldLabel required>Max chat points per day (UTC)</FieldLabel>
          <input
            type="number"
            min={0}
            step={1}
            value={capValue}
            onChange={(e) => setCapValue(e.target.value)}
          />
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={() => setEditCap(false)} disabled={savingCap}>
              Cancel
            </button>
            <button type="button" onClick={() => void saveCap()} disabled={savingCap}>
              {savingCap ? 'Saving…' : 'Save cap'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
