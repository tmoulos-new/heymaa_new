/** Admin: view and update subscription plans catalog. */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { CreditCard, Pencil, RefreshCw, X } from 'lucide-react'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { apiDetail } from '../lib/api'
import type { PlanRow } from '../lib/types'

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
        aria-labelledby="plans-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="plans-modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function PlansTab() {
  const { adminFetch } = useAdmin()
  const { show, Message } = useFlashMessage()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [tableReady, setTableReady] = useState(true)

  const [editRow, setEditRow] = useState<PlanRow | null>(null)
  const [name, setName] = useState('')
  const [priceLabel, setPriceLabel] = useState('')
  const [periodLabel, setPeriodLabel] = useState('')
  const [badge, setBadge] = useState('')
  const [icon, setIcon] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [voiceQuota, setVoiceQuota] = useState('')
  const [txCount, setTxCount] = useState('0')
  const [txCost, setTxCost] = useState('0')
  const [txLimit, setTxLimit] = useState('')
  const [txCostLimit, setTxCostLimit] = useState('')
  const [featured, setFeatured] = useState(false)
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadPlans = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const d = (await adminFetch('/admin/plans')) as {
        plans?: PlanRow[]
        table_ready?: boolean
        error?: string
      }
      setPlans(d.plans || [])
      setTableReady(d.table_ready !== false)
      if (d.error) setErr(String(d.error))
    } catch (e) {
      setErr((e instanceof Error && e.message) || 'Failed to load plans')
      setPlans([])
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => {
    void loadPlans()
  }, [loadPlans])

  const openEdit = (row: PlanRow) => {
    setEditRow(row)
    setName(row.name || '')
    setPriceLabel(row.price_label || '')
    setPeriodLabel(row.period_label || '')
    setBadge(row.badge || '')
    setIcon(row.icon || '')
    setSortOrder(String(row.sort_order ?? 0))
    setVoiceQuota(row.voice_listen_quota != null ? String(row.voice_listen_quota) : '')
    setTxCount(String(row.tx_count ?? 0))
    setTxCost(Number(row.tx_cost_usd || 0).toFixed(4))
    setTxLimit(row.tx_limit != null ? String(row.tx_limit) : '')
    setTxCostLimit(
      row.tx_cost_limit_usd != null ? Number(row.tx_cost_limit_usd).toFixed(4) : '',
    )
    setFeatured(Boolean(row.featured))
    setActive(row.active !== false)
  }

  const closeEdit = () => {
    if (saving) return
    setEditRow(null)
  }

  const savePlan = async () => {
    if (!editRow) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      show('Name is required', 'err')
      return
    }
    const order = Number(sortOrder)
    if (!Number.isFinite(order)) {
      show('Sort order must be a number', 'err')
      return
    }
    let quota: number | null = null
    if (voiceQuota.trim() !== '') {
      quota = Number(voiceQuota)
      if (!Number.isInteger(quota) || quota < 0) {
        show('Voice quota must be a non-negative integer', 'err')
        return
      }
    }
    const txCountNum = Number(txCount)
    if (!Number.isInteger(txCountNum) || txCountNum < 0) {
      show('LLM txs must be a non-negative integer', 'err')
      return
    }
    const txCostNum = Number(txCost)
    if (!Number.isFinite(txCostNum) || txCostNum < 0) {
      show('Tx cost must be a non-negative number', 'err')
      return
    }
    let txLimitNum: number | null = null
    if (txLimit.trim() !== '') {
      txLimitNum = Number(txLimit)
      if (!Number.isInteger(txLimitNum) || txLimitNum < 0) {
        show('Tx limit must be a non-negative integer (or empty for unlimited)', 'err')
        return
      }
    }
    let txCostLimitNum: number | null = null
    if (txCostLimit.trim() !== '') {
      txCostLimitNum = Number(txCostLimit)
      if (!Number.isFinite(txCostLimitNum) || txCostLimitNum < 0) {
        show('Cost limit must be a non-negative number (or empty for unlimited)', 'err')
        return
      }
    }
    setSaving(true)
    try {
      const d = await adminFetch(`/admin/plans/${encodeURIComponent(editRow.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          price_label: priceLabel.trim() || null,
          period_label: periodLabel.trim() || null,
          badge: badge.trim() || null,
          icon: icon.trim() || null,
          sort_order: Math.round(order),
          voice_listen_quota: quota,
          tx_count: txCountNum,
          tx_cost_usd: Number(txCostNum.toFixed(6)),
          tx_limit: txLimitNum,
          tx_cost_limit_usd: txCostLimitNum != null ? Number(txCostLimitNum.toFixed(6)) : null,
          featured,
          active,
        }),
      })
      if (d.ok) {
        show('Plan updated ✓', 'ok')
        setEditRow(null)
        void loadPlans()
      } else {
        show(apiDetail(d) || 'Failed to update plan', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>
          <CreditCard size={16} className="h-icon" /> Plans
        </h2>
        <button type="button" className="sec sm" onClick={() => void loadPlans()} disabled={loading}>
          <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
          Refresh
        </button>
      </div>
      {Message}
      <p className="card-desc">
        Subscription catalog linked to users via <code>plan_id</code>. Ids are fixed (trial / starter /
        premium / annual). <strong>LLM txs</strong> and <strong>Tx cost</strong> are stored on{' '}
        <code>plans.tx_count</code> / <code>plans.tx_cost_usd</code> and updated on each API call.
      </p>

      {!tableReady && (
        <div className="msg err">
          Table <code>plans</code> is missing. Run{' '}
          <code>backend/migrations/plans_and_users_plan_id.sql</code> in Supabase.
        </div>
      )}
      {err && tableReady ? <div className="msg err">{err}</div> : null}
      {loading && <div className="empty">Loading…</div>}
      {!loading && !err && plans.length === 0 && tableReady && (
        <div className="empty">No plans found.</div>
      )}

      {!loading && plans.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Id</th>
                <th>Name</th>
                <th>Price</th>
                <th>Period</th>
                <th>Users</th>
                <th>LLM txs</th>
                <th>Tx cost</th>
                <th>Tx limit</th>
                <th>Cost limit</th>
                <th>Voice / mo</th>
                <th>Order</th>
                <th>Flags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} style={{ opacity: p.active === false ? 0.55 : 1 }}>
                  <td style={{ fontSize: 20, width: 36 }}>{p.icon || '·'}</td>
                  <td>
                    <code>{p.id}</code>
                  </td>
                  <td>
                    <strong>{p.name}</strong>
                    {p.badge ? (
                      <div className="muted" style={{ fontSize: 11 }}>
                        {p.badge}
                      </div>
                    ) : null}
                  </td>
                  <td>{p.price_label || '—'}</td>
                  <td>{p.period_label || '—'}</td>
                  <td>{p.user_count ?? 0}</td>
                  <td>
                    <strong>{p.tx_count ?? 0}</strong>
                  </td>
                  <td>
                    ${Number(p.tx_cost_usd || 0).toFixed(4)}
                  </td>
                  <td>{p.tx_limit != null ? p.tx_limit : '∞'}</td>
                  <td>
                    {p.tx_cost_limit_usd != null
                      ? `$${Number(p.tx_cost_limit_usd).toFixed(4)}`
                      : '∞'}
                  </td>
                  <td>{p.voice_listen_quota ?? '—'}</td>
                  <td>{p.sort_order}</td>
                  <td>
                    {p.featured ? (
                      <span className="badge" style={{ background: '#2B3A67', marginRight: 4 }}>
                        featured
                      </span>
                    ) : null}
                    {p.active === false ? (
                      <span className="badge" style={{ background: '#8A8A8A' }}>
                        inactive
                      </span>
                    ) : (
                      <span className="badge" style={{ background: '#2D9E6B' }}>
                        active
                      </span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="sec sm" onClick={() => openEdit(p)}>
                      <Pencil size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow && (
        <Modal title={`Edit plan · ${editRow.id}`} onClose={closeEdit}>
          <p className="card-desc" style={{ marginTop: 0 }}>
            Plan id <code>{editRow.id}</code> cannot be changed (users reference it).
          </p>
          <FieldLabel required>Name</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <div>
              <FieldLabel>Price label</FieldLabel>
              <input
                value={priceLabel}
                onChange={(e) => setPriceLabel(e.target.value)}
                placeholder="€19"
              />
            </div>
            <div>
              <FieldLabel>Period label</FieldLabel>
              <input
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="/month"
              />
            </div>
          </div>
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <div>
              <FieldLabel>Badge</FieldLabel>
              <input
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="Popular"
              />
            </div>
            <div>
              <FieldLabel>Icon</FieldLabel>
              <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="👑" />
            </div>
          </div>
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <div>
              <FieldLabel>Sort order</FieldLabel>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Voice replies / month</FieldLabel>
              <input
                type="number"
                min={0}
                value={voiceQuota}
                onChange={(e) => setVoiceQuota(e.target.value)}
                placeholder="150"
              />
            </div>
          </div>
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <div>
              <FieldLabel>LLM txs used (tx_count)</FieldLabel>
              <input
                type="number"
                min={0}
                step={1}
                value={txCount}
                onChange={(e) => setTxCount(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Tx cost used USD (tx_cost_usd)</FieldLabel>
              <input
                type="number"
                min={0}
                step="0.0001"
                value={txCost}
                onChange={(e) => setTxCost(e.target.value)}
              />
            </div>
          </div>
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <div>
              <FieldLabel>Tx limit per user (tx_limit)</FieldLabel>
              <input
                type="number"
                min={0}
                step={1}
                value={txLimit}
                onChange={(e) => setTxLimit(e.target.value)}
                placeholder="empty = unlimited"
              />
            </div>
            <div>
              <FieldLabel>Cost limit per user USD</FieldLabel>
              <input
                type="number"
                min={0}
                step="0.0001"
                value={txCostLimit}
                onChange={(e) => setTxCostLimit(e.target.value)}
                placeholder="empty = unlimited"
              />
            </div>
          </div>
          <div className="checkbox-row" style={{ marginTop: 14, gap: 16 }}>
            <label>
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
              />
              Featured
            </label>
            <label>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" className="ghost sm" onClick={closeEdit} disabled={saving}>
              Cancel
            </button>
            <button type="button" onClick={() => void savePlan()} disabled={saving}>
              {saving ? 'Saving…' : 'Save plan'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
